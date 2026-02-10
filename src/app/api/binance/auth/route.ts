import { NextResponse } from "next/server";
import { BinanceClient } from "@/services/binance";
import { getAuthUser } from "@/lib/auth";
import { encryptCredentials } from "@/lib/crypto";
import { binanceAuthSchema, parseBody } from "@/lib/api-schemas";
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

    const raw = await request.json();
    const [body, validationError] = parseBody(binanceAuthSchema, raw);
    if (validationError) return validationError;

    const { apiKey, apiSecret } = body;

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

    const credentials = encryptCredentials({ apiKey, apiSecret });

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
