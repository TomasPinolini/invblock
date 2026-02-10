import { NextResponse } from "next/server";
import { IOLClient } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(user.id, "iol-notifications", RATE_LIMITS.default);
  if (rateLimited) return rateLimited;

  try {
    // Get IOL credentials
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

    // Fetch notifications from IOL
    // Note: This endpoint may not be available for all account types
    // or may return different structures
    try {
      const result = await client.getNotifications();

      // Handle various response formats
      const notifications = Array.isArray(result) ? result : [];

      return NextResponse.json({ notifications });
    } catch {
      // If the notifications endpoint fails, return empty array (non-critical)
      return NextResponse.json({ notifications: [] });
    }
  } catch (error) {
    console.error("[IOL Notifications] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}
