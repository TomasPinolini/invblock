import { NextResponse } from "next/server";
import { IOLClient, IOLTokenExpiredError, type IOLPortfolioItem } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections, assets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { AssetCategory } from "@/lib/constants";

function mapIOLCategory(item: IOLPortfolioItem): AssetCategory {
  const tipo = item.titulo?.tipo?.toLowerCase() || "";
  const pais = item.titulo?.pais?.toLowerCase() || "";

  if (tipo.includes("cedear")) return "cedear";
  if (tipo.includes("crypto") || tipo.includes("cripto")) return "crypto";
  if (pais === "estados_unidos") return "stock";
  if (tipo.includes("accion") || tipo.includes("acción")) return "stock";

  return "stock"; // default
}

function mapIOLCurrency(item: IOLPortfolioItem): "USD" | "ARS" {
  const moneda = item.titulo?.moneda?.toLowerCase() || "";
  if (moneda.includes("dolar") || moneda.includes("dollar")) return "USD";
  return "ARS";
}

export async function POST() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(user.id, "iol-sync", RATE_LIMITS.default);
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

    // Fetch portfolios from IOL
    const { argentina, us } = await client.getAllPortfolios();

    // Combine all assets
    const iolAssets = [
      ...(argentina.activos || []),
      ...(us.activos || []),
    ];

    // Get existing assets for this user
    const existingAssets = await db.query.assets.findMany({
      where: eq(assets.userId, user.id),
    });

    const existingByTicker = new Map(
      existingAssets.map((a) => [a.ticker.toUpperCase(), a])
    );

    let created = 0;
    let updated = 0;

    for (const item of iolAssets) {
      const simbolo = item.titulo?.simbolo;

      if (!simbolo || item.cantidad <= 0) {
        continue;
      }

      const ticker = simbolo.toUpperCase();
      const existing = existingByTicker.get(ticker);

      if (existing) {
        // Update existing asset
        await db
          .update(assets)
          .set({
            quantity: item.cantidad.toString(),
            averagePrice: item.ppc.toString(),
            currentPrice: item.ultimoPrecio.toString(),
            updatedAt: new Date(),
          })
          .where(eq(assets.id, existing.id));
        updated++;
      } else {
        // Create new asset
        const newAsset = {
          userId: user.id,
          ticker,
          name: item.titulo?.descripcion || ticker,
          category: mapIOLCategory(item),
          currency: mapIOLCurrency(item),
          quantity: item.cantidad.toString(),
          averagePrice: item.ppc.toString(),
          currentPrice: item.ultimoPrecio.toString(),
        };
        await db.insert(assets).values(newAsset);
        created++;
      }
    }

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
      success: true,
      created,
      updated,
      total: iolAssets.length,
    });
  } catch (error) {
    if (error instanceof IOLTokenExpiredError) {
      return NextResponse.json({
        success: false,
        expired: true,
        error: "Session expired. Please reconnect your IOL account.",
      });
    }
    console.error("IOL sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
