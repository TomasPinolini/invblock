import { NextResponse } from "next/server";
import { PPIClient, PPITokenExpiredError } from "@/services/ppi";
import type { PPICredentials } from "@/services/ppi";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(user.id, "ppi-balance", RATE_LIMITS.default);
  if (rateLimited) return rateLimited;

  try {
    const connection = await db.query.userConnections.findFirst({
      where: and(
        eq(userConnections.userId, user.id),
        eq(userConnections.provider, "ppi")
      ),
    });

    if (!connection) {
      return NextResponse.json(
        { error: "PPI account not connected" },
        { status: 400 }
      );
    }

    const credentials = decryptCredentials<PPICredentials>(connection.credentials);
    const client = new PPIClient(credentials);

    const data = await client.getAvailableBalance();

    // Aggregate balances by currency (same shape as IOL balance route)
    const balances = {
      ars: { disponible: 0, comprometido: 0, total: 0 },
      usd: { disponible: 0, comprometido: 0, total: 0 },
    };

    for (const b of data.Balances || []) {
      const currency = (b.Currency || "").toUpperCase();
      const isUSD = currency.includes("USD") || currency.includes("DOLAR");
      const target = isUSD ? balances.usd : balances.ars;

      target.disponible += b.Available || 0;
      target.comprometido += b.Committed || 0;
      target.total += b.Amount || 0;
    }

    return NextResponse.json({ balances });
  } catch (error) {
    if (error instanceof PPITokenExpiredError) {
      return NextResponse.json({ expired: true, error: "Session expired" });
    }
    console.error("[PPI Balance] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
