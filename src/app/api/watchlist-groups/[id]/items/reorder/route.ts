import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchlistGroups, watchlistGroupItems } from "@/db/schema";
import { watchlistGroupItemsReorderSchema } from "@/lib/validators";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PUT(
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
    const parsed = watchlistGroupItemsReorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.issues },
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

    const { itemIds } = parsed.data;

    await Promise.all(
      itemIds.map((id, index) =>
        db
          .update(watchlistGroupItems)
          .set({ sortOrder: index })
          .where(
            and(
              eq(watchlistGroupItems.id, id),
              eq(watchlistGroupItems.groupId, groupId)
            )
          )
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Group Items Reorder] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reorder items" },
      { status: 500 }
    );
  }
}
