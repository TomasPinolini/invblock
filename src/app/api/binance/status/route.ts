import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ connected: false });
    }

    const connection = await db
      .select()
      .from(userConnections)
      .where(
        and(
          eq(userConnections.userId, user.id),
          eq(userConnections.provider, "binance")
        )
      )
      .limit(1);

    if (connection.length === 0) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      updatedAt: connection[0].updatedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Binance status error:", error);
    return NextResponse.json({ connected: false });
  }
}
