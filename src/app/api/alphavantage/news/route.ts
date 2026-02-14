import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getNewsSentiment, getDailyBudgetStatus } from "@/services/alphavantage";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tickersParam = req.nextUrl.searchParams.get("tickers");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");
    const tickers = tickersParam ? tickersParam.split(",").filter(Boolean) : undefined;

    const data = await getNewsSentiment(tickers, Math.min(limit, 50));
    const budget = getDailyBudgetStatus();

    return NextResponse.json({ data, budget });
  } catch (error) {
    console.error("[AV News] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch news" },
      { status: 500 }
    );
  }
}
