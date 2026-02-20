import { NextResponse } from "next/server";
import { PPIClient, PPITokenExpiredError } from "@/services/ppi";
import type { PPICredentials, PPIPosition } from "@/services/ppi";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

import type { BrokerPortfolioAsset } from "@/types/portfolio";

function mapCategory(instrumentType: string): BrokerPortfolioAsset["category"] {
  const t = (instrumentType || "").toUpperCase();
  if (t.includes("CEDEAR")) return "cedear";
  if (t.includes("ACCION")) return "stock";
  if (t.includes("ETF")) return "stock";
  if (t.includes("BONO") || t.includes("LETRA") || t === "ON") return "stock";
  return "stock";
}

function mapCurrency(currency: string): "USD" | "ARS" {
  const c = (currency || "").toUpperCase();
  if (c.includes("USD") || c.includes("DOLAR") || c.includes("DOLLAR")) return "USD";
  return "ARS";
}

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(user.id, "ppi-portfolio", RATE_LIMITS.default);
  if (rateLimited) return rateLimited;

  try {
    const connection = await db.query.userConnections.findFirst({
      where: and(
        eq(userConnections.userId, user.id),
        eq(userConnections.provider, "ppi")
      ),
    });

    if (!connection) {
      return NextResponse.json({ connected: false, assets: [] });
    }

    const credentials = decryptCredentials<PPICredentials>(connection.credentials);
    const client = new PPIClient(credentials);

    const data = await client.getBalancesAndPositions();

    const assets: BrokerPortfolioAsset[] = (data.Positions || [])
      .filter((p: PPIPosition) => p.Ticker && p.Quantity > 0)
      .map((p: PPIPosition) => ({
        id: `ppi-${p.Ticker}`,
        ticker: p.Ticker.toUpperCase(),
        name: p.Description || p.Ticker,
        category: mapCategory(p.InstrumentType),
        currency: mapCurrency(p.Currency),
        quantity: p.Quantity,
        averagePrice: p.AveragePrice,
        currentPrice: p.Price,
        currentValue: p.Amount,
        pnl: p.PnL,
        pnlPercent: p.PnLPercentage,
      }));

    // Update token if refreshed
    const newCreds = client.getCredentials();
    if (newCreds.accessToken !== credentials.accessToken) {
      await db
        .update(userConnections)
        .set({
          credentials: encryptCredentials(newCreds),
          updatedAt: new Date(),
        })
        .where(eq(userConnections.id, connection.id));
    }

    return NextResponse.json({
      connected: true,
      assets,
    });
  } catch (error) {
    console.error("PPI portfolio fetch error:", error);

    if (error instanceof PPITokenExpiredError) {
      return NextResponse.json({
        connected: false,
        expired: true,
        assets: [],
        error: "Session expired. Please reconnect your PPI account.",
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}
