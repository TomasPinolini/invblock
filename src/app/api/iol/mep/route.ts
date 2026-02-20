import { NextResponse } from "next/server";
import { IOLClient, IOLTokenExpiredError } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_FEE = 0.006; // IOL charges ~0.6% for MEP operations

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(user.id, "mep", RATE_LIMITS.mep);
  if (rateLimited) return rateLimited;

  try {
    const connection = await db.query.userConnections.findFirst({
      where: and(
        eq(userConnections.userId, user.id),
        eq(userConnections.provider, "iol")
      ),
    });

    if (!connection) {
      return NextResponse.json(
        { error: "IOL account not connected" },
        { status: 400 }
      );
    }

    const token = decryptCredentials<IOLToken>(connection.credentials);
    const client = new IOLClient(token);

    const mepRates = await client.getMepRates();

    // Update token if refreshed
    const newToken = client.getToken();
    if (newToken && newToken.access_token !== token.access_token) {
      await db
        .update(userConnections)
        .set({
          credentials: encryptCredentials(newToken),
          updatedAt: new Date(),
        })
        .where(eq(userConnections.id, connection.id));
    }

    // Optional calculator
    const { searchParams } = new URL(request.url);
    const amountStr = searchParams.get("amount");
    const direction = searchParams.get("direction") as "buy" | "sell" | null;

    let estimate = null;
    if (amountStr && mepRates.averageRate > 0) {
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        const fee = DEFAULT_FEE;
        if (direction === "sell") {
          // Selling USD → get ARS
          const arsGross = amount * mepRates.averageRate;
          const feeAmount = arsGross * fee;
          estimate = {
            amount,
            direction: "sell",
            arsResult: arsGross - feeAmount,
            fee,
            feeAmount,
            rate: mepRates.averageRate,
          };
        } else {
          // Buying USD with ARS (default)
          const arsRequired = amount * mepRates.averageRate;
          const feeAmount = arsRequired * fee;
          estimate = {
            amount,
            direction: "buy",
            arsRequired: arsRequired + feeAmount,
            fee,
            feeAmount,
            rate: mepRates.averageRate,
          };
        }
      }
    }

    return NextResponse.json({
      ...mepRates,
      estimate,
    });
  } catch (error) {
    if (error instanceof IOLTokenExpiredError) {
      return NextResponse.json({ expired: true, error: "Session expired" });
    }
    console.error("[MEP] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch MEP rates" },
      { status: 500 }
    );
  }
}
