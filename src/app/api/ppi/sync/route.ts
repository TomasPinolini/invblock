import { NextResponse } from "next/server";
import { PPIClient, PPITokenExpiredError } from "@/services/ppi";
import type { PPICredentials, PPIPosition } from "@/services/ppi";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections, assets } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { AssetCategory } from "@/lib/constants";
import type { NewAsset } from "@/db/schema";

function mapPPICategory(position: PPIPosition): AssetCategory {
  const t = (position.InstrumentType || "").toUpperCase();
  if (t.includes("CEDEAR")) return "cedear";
  if (t.includes("ACCION")) return "stock";
  if (t.includes("ETF")) return "stock";
  if (t.includes("BONO") || t.includes("LETRA") || t === "ON") return "stock";
  return "stock";
}

function mapPPICurrency(position: PPIPosition): "USD" | "ARS" {
  const c = (position.Currency || "").toUpperCase();
  if (c.includes("USD") || c.includes("DOLAR")) return "USD";
  return "ARS";
}

export async function POST() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(user.id, "ppi-sync", RATE_LIMITS.default);
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

    const data = await client.getBalancesAndPositions();
    const positions = (data.Positions || []).filter(
      (p) => p.Ticker && p.Quantity > 0
    );

    // Build array of assets to upsert
    const toUpsert: NewAsset[] = positions.map((position) => ({
      userId: user.id,
      ticker: position.Ticker.toUpperCase(),
      name: position.Description || position.Ticker.toUpperCase(),
      category: mapPPICategory(position),
      currency: mapPPICurrency(position),
      quantity: position.Quantity.toString(),
      averagePrice: position.AveragePrice.toString(),
      currentPrice: position.Price.toString(),
    }));

    let synced = 0;

    if (toUpsert.length > 0) {
      await db
        .insert(assets)
        .values(toUpsert)
        .onConflictDoUpdate({
          target: [assets.userId, assets.ticker, assets.category],
          set: {
            quantity: sql`excluded.quantity`,
            averagePrice: sql`excluded.average_price`,
            currentPrice: sql`excluded.current_price`,
            updatedAt: new Date(),
          },
        });
      synced = toUpsert.length;
    }

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
      success: true,
      synced,
      total: positions.length,
    });
  } catch (error) {
    if (error instanceof PPITokenExpiredError) {
      return NextResponse.json({
        success: false,
        expired: true,
        error: "Session expired. Please reconnect your PPI account.",
      });
    }
    console.error("PPI sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
