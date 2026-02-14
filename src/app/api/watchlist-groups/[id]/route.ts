import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchlistGroups } from "@/db/schema";
import { watchlistGroupUpdateSchema } from "@/lib/validators";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = watchlistGroupUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const updates = parsed.data;

    // Check duplicate name if renaming
    if (updates.name) {
      const existing = await db
        .select({ id: watchlistGroups.id })
        .from(watchlistGroups)
        .where(
          and(
            eq(watchlistGroups.userId, user.id),
            eq(watchlistGroups.name, updates.name)
          )
        )
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        return NextResponse.json(
          { message: `A group named "${updates.name}" already exists` },
          { status: 409 }
        );
      }
    }

    const [row] = await db
      .update(watchlistGroups)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(watchlistGroups.id, id), eq(watchlistGroups.userId, user.id)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (error) {
    console.error("[Watchlist Group PATCH] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update group" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [row] = await db
      .delete(watchlistGroups)
      .where(and(eq(watchlistGroups.id, id), eq(watchlistGroups.userId, user.id)))
      .returning({ id: watchlistGroups.id });

    if (!row) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Watchlist Group DELETE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete group" },
      { status: 500 }
    );
  }
}
