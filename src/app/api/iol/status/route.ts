import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await db.query.userConnections.findFirst({
    where: and(
      eq(userConnections.userId, user.id),
      eq(userConnections.provider, "iol")
    ),
  });

  return NextResponse.json({
    connected: !!connection,
    updatedAt: connection?.updatedAt ?? null,
  });
}
