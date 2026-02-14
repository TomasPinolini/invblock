import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchlistGroups, watchlistGroupItems, watchlist } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { getQuote } from "@/services/yahoo/client";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: groupId } = await params;

    // Verify group belongs to user
    const group = await db
      .select({ id: watchlistGroups.id, name: watchlistGroups.name })
      .from(watchlistGroups)
      .where(and(eq(watchlistGroups.id, groupId), eq(watchlistGroups.userId, user.id)))
      .limit(1);

    if (group.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Get group's watchlist items
    const items = await db.query.watchlistGroupItems.findMany({
      where: eq(watchlistGroupItems.groupId, groupId),
      orderBy: asc(watchlistGroupItems.sortOrder),
      with: {
        watchlistEntry: true,
      },
    });

    if (items.length === 0) {
      return NextResponse.json({ securities: [], count: 0 });
    }

    // Batch fetch Yahoo quotes (same pattern as /api/watchlist/prices)
    const BATCH_SIZE = 8;
    const prices = new Map<
      string,
      { price: number; change: number; previousClose: number }
    >();

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (item) => {
          const entry = item.watchlistEntry;
          const quote = await getQuote(entry.ticker, entry.category);
          if (quote && quote.price > 0) {
            prices.set(entry.ticker, {
              price: quote.price,
              change: quote.changePercent,
              previousClose: quote.previousClose,
            });
          }
        })
      );
    }

    const securities = items.map((item) => {
      const entry = item.watchlistEntry;
      const priceData = prices.get(entry.ticker);
      return {
        simbolo: entry.ticker,
        descripcion: entry.name,
        ultimoPrecio: priceData?.price ?? 0,
        variacionPorcentual: priceData?.change ?? 0,
        cierreAnterior: priceData?.previousClose ?? undefined,
        _watchlistId: entry.id,
        _groupItemId: item.id,
        _category: entry.category,
        _notes: entry.notes,
      };
    });

    return NextResponse.json({ securities, count: securities.length });
  } catch (error) {
    console.error("[Group Prices] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch prices" },
      { status: 500 }
    );
  }
}
