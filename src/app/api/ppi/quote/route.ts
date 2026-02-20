import { NextResponse } from "next/server";
import { PPIClient, PPITokenExpiredError } from "@/services/ppi";
import type { PPICredentials } from "@/services/ppi";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Single quote: /api/ppi/quote?symbol=GGAL&type=ACCIONES&settlement=A-48HS
export async function GET(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(user.id, "ppi-quote", RATE_LIMITS.quote);
  if (rateLimited) return rateLimited;

  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const type = searchParams.get("type") || "ACCIONES";
    const settlement = searchParams.get("settlement") || "A-48HS";

    if (!symbol) {
      return NextResponse.json(
        { error: "symbol query parameter is required" },
        { status: 400 }
      );
    }

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

    try {
      const quote = await client.getQuote(symbol, type, settlement);
      return NextResponse.json({ symbol, type, quote });
    } catch {
      return NextResponse.json({ symbol, type, quote: null, error: "Quote not available" });
    }
  } catch (error) {
    if (error instanceof PPITokenExpiredError) {
      return NextResponse.json({ expired: true, error: "Session expired" });
    }
    console.error("[PPI Quote] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// POST - Batch quotes: { tickers: [{ ticker, type, settlement? }] }
export async function POST(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(user.id, "ppi-quotes-batch", RATE_LIMITS.quote);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const tickers: Array<{ ticker: string; type: string; settlement?: string }> =
      body.tickers || [];

    if (tickers.length === 0) {
      return NextResponse.json({ quotes: {} });
    }

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

    const quotesMap = await client.getQuotes(tickers);

    // Convert Map to plain object
    const quotes: Record<string, unknown> = {};
    for (const [key, value] of quotesMap) {
      quotes[key] = value;
    }

    return NextResponse.json({ quotes });
  } catch (error) {
    if (error instanceof PPITokenExpiredError) {
      return NextResponse.json({ expired: true, error: "Session expired" });
    }
    console.error("[PPI Quotes Batch] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}
