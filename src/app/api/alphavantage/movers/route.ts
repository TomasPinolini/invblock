import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getTopMovers, getDailyBudgetStatus } from "@/services/alphavantage";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getTopMovers();
    const budget = getDailyBudgetStatus();

    if (!data) {
      return NextResponse.json(
        { error: "Could not fetch market movers", budget },
        { status: 502 }
      );
    }

    return NextResponse.json({ data, budget });
  } catch (error) {
    console.error("[AV Movers] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch movers" },
      { status: 500 }
    );
  }
}
