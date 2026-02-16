import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db";
import { portfolioSnapshots } from "@/db/schema";
import { eq, desc, gte, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const days = Math.min(
      Math.max(parseInt(searchParams.get("days") || "90", 10) || 90, 1),
      365
    );

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];

    const snapshots = await db
      .select({
        id: portfolioSnapshots.id,
        snapshotDate: portfolioSnapshots.snapshotDate,
        totalValueUsd: portfolioSnapshots.totalValueUsd,
        totalCostUsd: portfolioSnapshots.totalCostUsd,
        totalPnlUsd: portfolioSnapshots.totalPnlUsd,
        totalPnlPercent: portfolioSnapshots.totalPnlPercent,
        assetCount: portfolioSnapshots.assetCount,
        byCategory: portfolioSnapshots.byCategory,
      })
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.userId, user.id),
          gte(portfolioSnapshots.snapshotDate, sinceStr)
        )
      )
      .orderBy(portfolioSnapshots.snapshotDate);

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error("[Snapshots] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch snapshots" },
      { status: 500 }
    );
  }
}
