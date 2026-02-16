import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db";
import { userEmailPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";

const updateSchema = z.object({
  dailyReport: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  priceAlerts: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
});

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let prefs = await db.query.userEmailPreferences.findFirst({
      where: eq(userEmailPreferences.userId, user.id),
    });

    // Create default row if none exists
    if (!prefs) {
      const [created] = await db
        .insert(userEmailPreferences)
        .values({ userId: user.id })
        .returning();
      prefs = created;
    }

    return NextResponse.json(prefs);
  } catch (error) {
    console.error("[Email Preferences] GET Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    // Upsert: update if exists, create if not
    const existing = await db.query.userEmailPreferences.findFirst({
      where: eq(userEmailPreferences.userId, user.id),
    });

    let prefs;
    if (existing) {
      [prefs] = await db
        .update(userEmailPreferences)
        .set({ ...parsed, updatedAt: new Date() })
        .where(eq(userEmailPreferences.userId, user.id))
        .returning();
    } else {
      [prefs] = await db
        .insert(userEmailPreferences)
        .values({ userId: user.id, ...parsed })
        .returning();
    }

    return NextResponse.json(prefs);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("[Email Preferences] PUT Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update preferences" },
      { status: 500 }
    );
  }
}
