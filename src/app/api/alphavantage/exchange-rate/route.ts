import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getExchangeRate, getDailyBudgetStatus } from "@/services/alphavantage";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const from = req.nextUrl.searchParams.get("from") || "USD";
    const to = req.nextUrl.searchParams.get("to") || "ARS";

    const data = await getExchangeRate(from, to);
    const budget = getDailyBudgetStatus();

    if (!data) {
      return NextResponse.json(
        { error: "Could not fetch exchange rate", budget },
        { status: 502 }
      );
    }

    return NextResponse.json({ data, budget });
  } catch (error) {
    console.error("[AV Exchange Rate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch exchange rate" },
      { status: 500 }
    );
  }
}
