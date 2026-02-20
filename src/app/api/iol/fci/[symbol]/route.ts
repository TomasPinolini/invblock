import { NextResponse } from "next/server";
import { IOLClient, IOLTokenExpiredError } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol } = await params;

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const rateLimited = await checkRateLimit(user.id, "fci-details", RATE_LIMITS.securities);
  if (rateLimited) return rateLimited;

  try {
    const connection = await db.query.userConnections.findFirst({
      where: and(
        eq(userConnections.userId, user.id),
        eq(userConnections.provider, "iol")
      ),
    });

    if (!connection) {
      return NextResponse.json(
        { error: "IOL account not connected" },
        { status: 400 }
      );
    }

    const token = decryptCredentials<IOLToken>(connection.credentials);
    const client = new IOLClient(token);

    const fund = await client.getFCIDetails(symbol);

    // Update token if refreshed
    const newToken = client.getToken();
    if (newToken && newToken.access_token !== token.access_token) {
      await db
        .update(userConnections)
        .set({
          credentials: encryptCredentials(newToken),
          updatedAt: new Date(),
        })
        .where(eq(userConnections.id, connection.id));
    }

    return NextResponse.json({ fund });
  } catch (error) {
    if (error instanceof IOLTokenExpiredError) {
      return NextResponse.json({ expired: true, error: "Session expired" });
    }
    console.error("[FCI Details] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch fund details" },
      { status: 500 }
    );
  }
}
