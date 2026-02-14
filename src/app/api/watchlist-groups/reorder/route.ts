import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchlistGroups } from "@/db/schema";
import { watchlistGroupReorderSchema } from "@/lib/validators";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = watchlistGroupReorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { groupIds } = parsed.data;

    // Update sort_order for each group
    await Promise.all(
      groupIds.map((id, index) =>
        db
          .update(watchlistGroups)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(and(eq(watchlistGroups.id, id), eq(watchlistGroups.userId, user.id)))
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Watchlist Groups Reorder] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reorder groups" },
      { status: 500 }
    );
  }
}
