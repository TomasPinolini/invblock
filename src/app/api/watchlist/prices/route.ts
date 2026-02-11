import { NextResponse } from "next/server";
import { db } from "@/db";
import { watchlist } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { getQuote } from "@/services/yahoo/client";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, user.id))
      .orderBy(desc(watchlist.createdAt));

    if (items.length === 0) {
      return NextResponse.json({ securities: [], count: 0 });
    }

    // Batch fetch Yahoo quotes for all watchlist tickers
    const BATCH_SIZE = 8;
    const prices = new Map<
      string,
      { price: number; change: number; previousClose: number }
    >();

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (item) => {
          const quote = await getQuote(item.ticker, item.category);
          if (quote && quote.price > 0) {
            prices.set(item.ticker, {
              price: quote.price,
              change: quote.changePercent,
              previousClose: quote.previousClose,
            });
          }
        })
      );
    }

    // Return in IOLSecurityWithQuote-compatible shape
    const securities = items.map((item) => {
      const priceData = prices.get(item.ticker);
      return {
        simbolo: item.ticker,
        descripcion: item.name,
        ultimoPrecio: priceData?.price ?? 0,
        variacionPorcentual: priceData?.change ?? 0,
        cierreAnterior: priceData?.previousClose ?? undefined,
        // Metadata for the client
        _watchlistId: item.id,
        _category: item.category,
        _notes: item.notes,
      };
    });

    return NextResponse.json({
      securities,
      count: securities.length,
    });
  } catch (error) {
    console.error("[Watchlist Prices] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
