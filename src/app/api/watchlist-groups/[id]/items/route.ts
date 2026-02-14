import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchlistGroups, watchlistGroupItems } from "@/db/schema";
import { watchlistGroupItemAddSchema } from "@/lib/validators";
import { getAuthUser } from "@/lib/auth";
import { eq, and, max } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: groupId } = await params;
    const body = await req.json();
    const parsed = watchlistGroupItemAddSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { watchlistId } = parsed.data;

    // Verify group belongs to user
    const group = await db
      .select({ id: watchlistGroups.id })
      .from(watchlistGroups)
      .where(and(eq(watchlistGroups.id, groupId), eq(watchlistGroups.userId, user.id)))
      .limit(1);

    if (group.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Check if already in group
    const existing = await db
      .select({ id: watchlistGroupItems.id })
      .from(watchlistGroupItems)
      .where(
        and(
          eq(watchlistGroupItems.groupId, groupId),
          eq(watchlistGroupItems.watchlistId, watchlistId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { message: "Item already in this group" },
        { status: 409 }
      );
    }

    // Get next sort order
    const [maxSort] = await db
      .select({ max: max(watchlistGroupItems.sortOrder) })
      .from(watchlistGroupItems)
      .where(eq(watchlistGroupItems.groupId, groupId));

    const nextSort = (maxSort?.max ?? -1) + 1;

    const [row] = await db
      .insert(watchlistGroupItems)
      .values({ groupId, watchlistId, sortOrder: nextSort })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("[Group Items POST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: groupId } = await params;
    const { searchParams } = new URL(req.url);
    const watchlistId = searchParams.get("watchlistId");

    if (!watchlistId) {
      return NextResponse.json(
        { message: "watchlistId query param required" },
        { status: 400 }
      );
    }

    // Verify group belongs to user
    const group = await db
      .select({ id: watchlistGroups.id })
      .from(watchlistGroups)
      .where(and(eq(watchlistGroups.id, groupId), eq(watchlistGroups.userId, user.id)))
      .limit(1);

    if (group.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const [row] = await db
      .delete(watchlistGroupItems)
      .where(
        and(
          eq(watchlistGroupItems.groupId, groupId),
          eq(watchlistGroupItems.watchlistId, watchlistId)
        )
      )
      .returning({ id: watchlistGroupItems.id });

    if (!row) {
      return NextResponse.json({ error: "Item not in group" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Group Items DELETE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove item" },
      { status: 500 }
    );
  }
}
