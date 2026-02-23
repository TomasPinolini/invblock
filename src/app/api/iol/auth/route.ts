import { NextRequest, NextResponse } from "next/server";
import { IOLClient } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { encryptCredentials } from "@/lib/crypto";
import { iolAuthSchema, parseBody } from "@/lib/api-schemas";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await req.json();
    const [body, validationError] = parseBody(iolAuthSchema, raw);
    if (validationError) return validationError;

    // Two modes:
    // 1. { username, password } → server authenticates with IOL API
    // 2. { token }             → browser already authenticated (bypasses Vercel IP restrictions)
    let token;
    if ("token" in body) {
      token = { ...body.token, issued_at: body.token.issued_at ?? Date.now() };
    } else {
      token = await IOLClient.authenticate(body.username, body.password);
    }

    // Store token in database (encrypted with AES-256-GCM)
    const existingConnection = await db.query.userConnections.findFirst({
      where: and(
        eq(userConnections.userId, user.id),
        eq(userConnections.provider, "iol")
      ),
    });

    if (existingConnection) {
      await db
        .update(userConnections)
        .set({
          credentials: encryptCredentials(token),
          updatedAt: new Date(),
        })
        .where(eq(userConnections.id, existingConnection.id));
    } else {
      await db.insert(userConnections).values({
        userId: user.id,
        provider: "iol",
        credentials: encryptCredentials(token),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("IOL auth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .delete(userConnections)
    .where(
      and(
        eq(userConnections.userId, user.id),
        eq(userConnections.provider, "iol")
      )
    );

  return NextResponse.json({ success: true });
}
