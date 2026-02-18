import { NextResponse } from "next/server";
import { PPIClient } from "@/services/ppi";
import { getAuthUser } from "@/lib/auth";
import { encryptCredentials } from "@/lib/crypto";
import { ppiAuthSchema, parseBody } from "@/lib/api-schemas";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST - Connect PPI account (authenticate with 4 API keys)
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await request.json();
    const [body, validationError] = parseBody(ppiAuthSchema, raw);
    if (validationError) return validationError;

    const { authorizedClient, clientKey, apiKey, apiSecret } = body;

    // Authenticate with PPI (apiSecret is optional)
    const credentials = await PPIClient.authenticate(
      authorizedClient,
      clientKey,
      apiKey,
      apiSecret || undefined
    );

    const encrypted = encryptCredentials(credentials);

    // Check if connection already exists
    const existing = await db
      .select()
      .from(userConnections)
      .where(
        and(
          eq(userConnections.userId, user.id),
          eq(userConnections.provider, "ppi")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userConnections)
        .set({ credentials: encrypted, updatedAt: new Date() })
        .where(eq(userConnections.id, existing[0].id));
    } else {
      await db.insert(userConnections).values({
        userId: user.id,
        provider: "ppi",
        credentials: encrypted,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PPI auth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect PPI account
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
          eq(userConnections.provider, "ppi")
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PPI disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
