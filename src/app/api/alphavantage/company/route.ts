import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getCompanyOverview, getDailyBudgetStatus } from "@/services/alphavantage";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const symbol = req.nextUrl.searchParams.get("symbol");
    if (!symbol) {
      return NextResponse.json({ error: "symbol parameter required" }, { status: 400 });
    }

    const data = await getCompanyOverview(symbol);
    const budget = getDailyBudgetStatus();

    if (!data) {
      return NextResponse.json(
        { error: "Could not fetch company data", budget },
        { status: 502 }
      );
    }

    return NextResponse.json({ data, budget });
  } catch (error) {
    console.error("[AV Company] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch company data" },
      { status: 500 }
    );
  }
}
