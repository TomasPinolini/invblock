import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getBatchPricesAtPeriod,
  getHistoricalPrices,
  type TimePeriod,
} from "@/services/yahoo/client";

// GET /api/prices/historical?tickers=AAPL,GOOGL&categories=cedear,cedear&period=1M
// Returns historical prices for calculating time-based returns
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tickersParam = searchParams.get("tickers");
    const categoriesParam = searchParams.get("categories");
    const period = (searchParams.get("period") || "1M") as TimePeriod;

    if (!tickersParam || !categoriesParam) {
      return NextResponse.json(
        { error: "Missing tickers or categories parameter" },
        { status: 400 }
      );
    }

    const tickers = tickersParam.split(",");
    const categories = categoriesParam.split(",");

    if (tickers.length !== categories.length) {
      return NextResponse.json(
        { error: "Tickers and categories arrays must have same length" },
        { status: 400 }
      );
    }

    const tickerData = tickers.map((ticker, i) => ({
      ticker,
      category: categories[i],
    }));

    // Fetch prices at the period start for all tickers
    const pricesAtPeriod = await getBatchPricesAtPeriod(tickerData, period);

    // Convert Map to object for JSON response
    const prices: Record<string, number> = {};
    pricesAtPeriod.forEach((price, ticker) => {
      prices[ticker] = price;
    });

    return NextResponse.json({
      period,
      prices,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Historical prices error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch prices" },
      { status: 500 }
    );
  }
}

// POST /api/prices/historical
// Get detailed historical data for a single ticker (for charts)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ticker, category, period } = body as {
      ticker: string;
      category: string;
      period: TimePeriod;
    };

    if (!ticker || !category || !period) {
      return NextResponse.json(
        { error: "Missing ticker, category, or period" },
        { status: 400 }
      );
    }

    const history = await getHistoricalPrices(ticker, category, period);

    return NextResponse.json({
      ticker,
      period,
      history,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Historical prices error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch prices" },
      { status: 500 }
    );
  }
}
