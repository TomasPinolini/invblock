import { NextResponse } from "next/server";
import { BinanceClient } from "@/services/binance";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST - Connect Binance account (store API keys)
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { apiKey, apiSecret } = await request.json();

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "API key and secret are required" },
        { status: 400 }
      );
    }

    // Test the credentials
    const client = new BinanceClient({ apiKey, apiSecret });
    const isValid = await client.testConnection();

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid API credentials. Check your key and secret." },
        { status: 401 }
      );
    }

    // Check if connection already exists
    const existing = await db
      .select()
      .from(userConnections)
      .where(
        and(
          eq(userConnections.userId, user.id),
          eq(userConnections.provider, "binance")
        )
      )
      .limit(1);

    const credentials = JSON.stringify({ apiKey, apiSecret });

    if (existing.length > 0) {
      // Update existing connection
      await db
        .update(userConnections)
        .set({ credentials, updatedAt: new Date() })
        .where(eq(userConnections.id, existing[0].id));
    } else {
      // Create new connection
      await db.insert(userConnections).values({
        userId: user.id,
        provider: "binance",
        credentials,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Binance auth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect Binance account
export async function DELETE() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db
      .delete(userConnections)
      .where(
        and(
          eq(userConnections.userId, user.id),
          eq(userConnections.provider, "binance")
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Binance disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
