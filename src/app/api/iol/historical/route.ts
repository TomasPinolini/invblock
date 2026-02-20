import { NextResponse } from "next/server";
import { IOLClient, IOLTokenExpiredError } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Map category to IOL market
function getMarketForCategory(category?: string): string {
  // CEDEARs and Argentine stocks trade on BCBA
  // US stocks on NYSE/NASDAQ (but IOL historical may not support these)
  return "bCBA";
}

export async function GET(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(user.id, "iol-historical", RATE_LIMITS.default);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const market = searchParams.get("market");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const adjusted = searchParams.get("adjusted") !== "false"; // Default true
  const category = searchParams.get("category");

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing symbol parameter" },
      { status: 400 }
    );
  }

  // Calculate date range if not provided
  const toDate = to || new Date().toISOString().split("T")[0];
  const fromDate = from || (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1); // Default to 1 year of history
    return d.toISOString().split("T")[0];
  })();

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

    // Use provided market or infer from category
    const targetMarket = market || getMarketForCategory(category ?? undefined);

    const history = await client.getHistoricalPrices(
      targetMarket,
      symbol.toUpperCase(),
      fromDate,
      toDate,
      adjusted
    );

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

    // Transform to consistent format
    const transformedHistory = history.map((h) => ({
      date: h.fecha,
      open: h.apertura,
      high: h.maximo,
      low: h.minimo,
      close: h.ultimoPrecio,
      volume: h.volumen,
    }));

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      market: targetMarket,
      from: fromDate,
      to: toDate,
      adjusted,
      history: transformedHistory,
      source: "iol",
    });
  } catch (error) {
    if (error instanceof IOLTokenExpiredError) {
      return NextResponse.json({ expired: true, history: [], error: "Session expired" });
    }
    console.error("IOL historical error:", error);
    return NextResponse.json(
      {
        symbol: symbol.toUpperCase(),
        history: [],
        error: error instanceof Error ? error.message : "Failed to fetch historical data",
        source: "iol",
      },
      { status: 500 }
    );
  }
}
