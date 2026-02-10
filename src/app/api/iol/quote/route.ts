import { NextResponse } from "next/server";
import { IOLClient, IOLTokenExpiredError } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { batchQuoteSchema, parseBody } from "@/lib/api-schemas";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Map category/ticker to IOL market
function getMarketForTicker(
  ticker: string,
  category?: string
): string {
  // US stocks/ETFs
  const usMarket = ["NYSE", "NASDAQ", "AMEX"];
  const usTickers = [
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "TSLA",
    "SPY", "QQQ", "IWM", "VOO", "VTI", "BRK.A", "BRK.B", "JPM", "V",
  ];

  if (category === "stock" && usTickers.includes(ticker.toUpperCase())) {
    return "nYSE"; // Default to NYSE, could be smarter
  }

  // CEDEARs and Argentine stocks trade on BCBA
  return "bCBA";
}

export async function GET(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(user.id, "quote", RATE_LIMITS.quote);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const market = searchParams.get("market");

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing symbol parameter" },
      { status: 400 }
    );
  }

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

    // Use provided market or infer from ticker
    const targetMarket = market || getMarketForTicker(symbol);

    const quote = await client.getQuote(targetMarket, symbol.toUpperCase());

    // Update token if it was refreshed
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
      symbol: symbol.toUpperCase(),
      market: targetMarket,
      quote,
    });
  } catch (error) {
    // Return null quote instead of error - non-critical feature
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      market: market || "bCBA",
      quote: null,
      error: error instanceof Error ? error.message : "Quote fetch failed",
    });
  }
}

// Batch endpoint for multiple quotes
export async function POST(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(user.id, "quote", RATE_LIMITS.quote);
  if (rateLimited) return rateLimited;

  try {
    const raw = await request.json();
    const [body, validationError] = parseBody(batchQuoteSchema, raw);
    if (validationError) return validationError;

    const tickers = body.tickers;

    if (!tickers.length) {
      return NextResponse.json({ quotes: {} });
    }

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

    // Prepare tickers with markets
    const tickersWithMarkets = tickers.map((t) => ({
      market: t.market || getMarketForTicker(t.symbol, t.category),
      symbol: t.symbol.toUpperCase(),
    }));

    // Fetch all quotes
    const quotesMap = await client.getQuotes(tickersWithMarkets);

    // Convert to object
    const quotes: Record<string, unknown> = {};
    quotesMap.forEach((quote, symbol) => {
      quotes[symbol] = quote;
    });

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

    return NextResponse.json({ quotes });
  } catch (error) {
    if (error instanceof IOLTokenExpiredError) {
      return NextResponse.json({ expired: true, quotes: {}, error: "Session expired" });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quotes fetch failed" },
      { status: 500 }
    );
  }
}
