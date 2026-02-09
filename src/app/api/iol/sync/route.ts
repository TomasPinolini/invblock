import { NextResponse } from "next/server";
import { IOLClient, type IOLPortfolioItem } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
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

    const token = JSON.parse(connection.credentials);
    const client = new IOLClient(token);

    // Fetch portfolios from IOL
    const { argentina, us } = await client.getAllPortfolios();

    console.log("[IOL Sync] Argentina portfolio:", JSON.stringify(argentina, null, 2));
    console.log("[IOL Sync] US portfolio:", JSON.stringify(us, null, 2));

    // Combine all assets
    const iolAssets = [
      ...(argentina.activos || []),
      ...(us.activos || []),
    ];

    console.log("[IOL Sync] Total assets found:", iolAssets.length);

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
      console.log("[IOL Sync] Processing item:", simbolo, "cantidad:", item.cantidad);

      if (!simbolo || item.cantidad <= 0) {
        console.log("[IOL Sync] Skipping - no simbolo or cantidad <= 0");
        continue;
      }

      const ticker = simbolo.toUpperCase();
      const existing = existingByTicker.get(ticker);

      if (existing) {
        // Update existing asset
        console.log("[IOL Sync] Updating existing asset:", ticker);
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
        console.log("[IOL Sync] Creating new asset:", JSON.stringify(newAsset));
        await db.insert(assets).values(newAsset);
        created++;
      }
    }

    console.log("[IOL Sync] Done. Created:", created, "Updated:", updated);

    // Update token if it was refreshed
    const newToken = client.getToken();
    if (newToken && newToken.access_token !== token.access_token) {
      await db
        .update(userConnections)
        .set({
          credentials: JSON.stringify(newToken),
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
    console.error("IOL sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
