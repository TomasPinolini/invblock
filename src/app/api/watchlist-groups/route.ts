import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchlistGroups, watchlistGroupItems, watchlist } from "@/db/schema";
import { watchlistGroupCreateSchema } from "@/lib/validators";
import { getAuthUser } from "@/lib/auth";
import { eq, and, asc } from "drizzle-orm";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const groups = await db.query.watchlistGroups.findMany({
      where: eq(watchlistGroups.userId, user.id),
      orderBy: asc(watchlistGroups.sortOrder),
      with: {
        items: {
          orderBy: asc(watchlistGroupItems.sortOrder),
          with: {
            watchlistEntry: true,
          },
        },
      },
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error("[Watchlist Groups GET] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch groups" },
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
    const parsed = watchlistGroupCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, color } = parsed.data;

    // Check for duplicate name per user
    const existing = await db
      .select({ id: watchlistGroups.id })
      .from(watchlistGroups)
      .where(and(eq(watchlistGroups.userId, user.id), eq(watchlistGroups.name, name)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { message: `A group named "${name}" already exists` },
        { status: 409 }
      );
    }

    // Get next sort order
    const lastGroup = await db
      .select({ sortOrder: watchlistGroups.sortOrder })
      .from(watchlistGroups)
      .where(eq(watchlistGroups.userId, user.id))
      .orderBy(asc(watchlistGroups.sortOrder))
      .limit(1);

    const nextSort = lastGroup.length > 0 ? lastGroup[0].sortOrder + 1 : 0;

    const [row] = await db
      .insert(watchlistGroups)
      .values({ userId: user.id, name, color, sortOrder: nextSort })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("[Watchlist Groups POST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create group" },
      { status: 500 }
    );
  }
}
