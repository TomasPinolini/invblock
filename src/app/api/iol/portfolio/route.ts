import { NextResponse } from "next/server";
import { IOLClient, IOLTokenExpiredError } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

import type { BrokerPortfolioAsset } from "@/types/portfolio";
import { mapIOLCategory, mapIOLCurrency } from "@/services/shared/mappers";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(user.id, "iol-portfolio", RATE_LIMITS.default);
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
      return NextResponse.json({ connected: false, assets: [] });
    }

    const token = decryptCredentials<IOLToken>(connection.credentials);
    const client = new IOLClient(token);

    // Fetch portfolios from IOL
    const { argentina, us } = await client.getAllPortfolios();

    // Combine and transform assets
    const iolAssets = [
      ...(argentina.activos || []),
      ...(us.activos || []),
    ];

    const assets: BrokerPortfolioAsset[] = iolAssets
      .filter((item) => item.titulo?.simbolo && item.cantidad > 0)
      .map((item) => ({
        id: item.titulo.simbolo, // Use ticker as ID since we're not storing
        ticker: item.titulo.simbolo.toUpperCase(),
        name: item.titulo.descripcion || item.titulo.simbolo,
        category: mapIOLCategory(item.titulo.tipo, item.titulo.pais),
        currency: mapIOLCurrency(item.titulo.moneda),
        quantity: item.cantidad,
        averagePrice: item.ppc,
        currentPrice: item.ultimoPrecio,
        currentValue: item.valorizado,
        pnl: item.gananciaDinero,
        pnlPercent: item.gananciaPorcentaje,
      }));

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
      connected: true,
      assets,
      totals: {
        pesos: argentina.totalEnPesos || 0,
        dolares: (argentina.totalEnDolares || 0) + (us.totalEnDolares || 0),
      },
    });
  } catch (error) {
    console.error("IOL portfolio fetch error:", error);

    // Token expired - tell frontend to reconnect
    if (error instanceof IOLTokenExpiredError) {
      return NextResponse.json({
        connected: false,
        expired: true,
        assets: [],
        error: "Session expired. Please reconnect your IOL account.",
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}
