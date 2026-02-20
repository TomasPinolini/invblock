import { NextResponse } from "next/server";
import { IOLClient, IOLTokenExpiredError } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(user.id, "iol-balance", RATE_LIMITS.default);
  if (rateLimited) return rateLimited;

  try {
    // Get IOL credentials
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

    // Fetch account state from IOL
    const accountState = await client.getAccountState();

    // Process accounts into a sanitized format — only expose what the frontend needs
    const balances = {
      ars: {
        disponible: 0,
        comprometido: 0,
        total: 0,
      },
      usd: {
        disponible: 0,
        comprometido: 0,
        total: 0,
      },
    };

    for (const cuenta of accountState.cuentas || []) {
      const moneda = (cuenta.moneda || "").toLowerCase();
      const tipo = (cuenta.tipo || "").toLowerCase();

      // Check if USD by moneda or tipo
      const isUSD = moneda.includes("dolar") || moneda.includes("dollar") ||
                    tipo.includes("dolar") || tipo.includes("estados_unidos");

      // Get disponibleOperar from saldos array (sum all settlement periods)
      // The "disponibleOperar" in hrs24/hrs48/hrs72 shows what you can trade with
      let disponibleOperar = 0;
      let comprometidoTotal = 0;

      if (cuenta.saldos && Array.isArray(cuenta.saldos)) {
        // Get the max disponibleOperar (usually from hrs24 or later)
        for (const saldo of cuenta.saldos) {
          if (saldo.disponibleOperar > disponibleOperar) {
            disponibleOperar = saldo.disponibleOperar;
          }
          comprometidoTotal += saldo.comprometido || 0;
        }
      }

      // Fallback to top-level if saldos not available
      if (disponibleOperar === 0) {
        disponibleOperar = cuenta.disponible || 0;
      }
      if (comprometidoTotal === 0) {
        comprometidoTotal = cuenta.comprometido || 0;
      }

      if (isUSD) {
        balances.usd.disponible += disponibleOperar;
        balances.usd.comprometido += comprometidoTotal;
        balances.usd.total += cuenta.total || cuenta.saldo || 0;
      } else {
        balances.ars.disponible += disponibleOperar;
        balances.ars.comprometido += comprometidoTotal;
        balances.ars.total += cuenta.total || cuenta.saldo || 0;
      }
    }

    // Return only the sanitized balances — never expose raw IOL API data
    return NextResponse.json({
      balances,
    });
  } catch (error) {
    if (error instanceof IOLTokenExpiredError) {
      return NextResponse.json({ expired: true, error: "Session expired" });
    }
    console.error("[IOL Balance] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
