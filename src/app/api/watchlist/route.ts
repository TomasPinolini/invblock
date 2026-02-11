import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchlist } from "@/db/schema";
import { watchlistCreateSchema } from "@/lib/validators";
import { getAuthUser } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, user.id))
      .orderBy(desc(watchlist.createdAt));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[Watchlist GET] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = watchlistCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { ticker, name, category, notes } = parsed.data;

    // Check for duplicate ticker per user
    const existing = await db
      .select({ id: watchlist.id })
      .from(watchlist)
      .where(and(eq(watchlist.userId, user.id), eq(watchlist.ticker, ticker)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { message: `${ticker} is already in your watchlist` },
        { status: 409 }
      );
    }

    const [row] = await db
      .insert(watchlist)
      .values({ userId: user.id, ticker, name, category, notes })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("[Watchlist POST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add to watchlist" },
      { status: 500 }
    );
  }
}
