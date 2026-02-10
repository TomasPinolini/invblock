import { NextResponse } from "next/server";
import { IOLClient } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(user.id, "iol-operations", RATE_LIMITS.default);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") || "todas") as
    | "todas"
    | "pendientes"
    | "canceladas"
    | "terminadas";
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");

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

    // Parse dates if provided
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    // Fetch operations
    const operations = await client.getOperations(status, from, to);

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

    return NextResponse.json({
      operations,
      total: operations.length,
      status,
    });
  } catch (error) {
    console.error("IOL operations fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
