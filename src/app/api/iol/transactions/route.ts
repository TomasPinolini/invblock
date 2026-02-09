import { NextResponse } from "next/server";
import { IOLClient } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db";
import { userConnections, assets, transactions } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";

// Map IOL operation type to our transaction type
function mapOperationType(tipo: string): "buy" | "sell" | null {
  const t = tipo.toLowerCase();
  if (t.includes("compra")) return "buy";
  if (t.includes("venta")) return "sell";
  return null;
}

// Map IOL currency
function mapCurrency(mercado: string): "USD" | "ARS" {
  const m = mercado.toLowerCase();
  if (m.includes("nyse") || m.includes("nasdaq") || m.includes("estados")) {
    return "USD";
  }
  return "ARS";
}

export async function POST() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    const token = JSON.parse(connection.credentials);
    const client = new IOLClient(token);

    // Fetch completed operations from the last 90 days
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90);

    const operations = await client.getOperations("terminadas", fromDate);

    console.log("[IOL Transactions] Fetched operations:", operations.length);

    // Get existing assets for this user
    const existingAssets = await db.query.assets.findMany({
      where: eq(assets.userId, user.id),
    });
    const assetsByTicker = new Map(
      existingAssets.map((a) => [a.ticker.toUpperCase(), a])
    );

    // Get existing transaction notes to avoid duplicates (IOL#xxx)
    const existingTxns = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, user.id),
        like(transactions.notes, "IOL#%")
      ),
    });
    const existingOpNumbers = new Set(
      existingTxns
        .map((t) => t.notes?.match(/IOL#(\d+)/)?.[1])
        .filter(Boolean)
    );

    let created = 0;
    let skipped = 0;

    for (const op of operations) {
      // Skip if already imported
      if (existingOpNumbers.has(String(op.numero))) {
        skipped++;
        continue;
      }

      const txnType = mapOperationType(op.tipo);
      if (!txnType) {
        console.log("[IOL Transactions] Skipping unknown type:", op.tipo);
        skipped++;
        continue;
      }

      const ticker = op.simbolo.toUpperCase();
      let asset = assetsByTicker.get(ticker);

      // Create asset if it doesn't exist
      if (!asset) {
        const [newAsset] = await db
          .insert(assets)
          .values({
            userId: user.id,
            ticker,
            name: ticker, // We don't have the full name from operations
            category: "cedear", // Default, could be improved
            currency: mapCurrency(op.mercado),
            quantity: "0",
            averagePrice: "0",
            currentPrice: op.precio.toString(),
          })
          .returning();

        asset = newAsset;
        assetsByTicker.set(ticker, asset);
        console.log("[IOL Transactions] Created asset for:", ticker);
      }

      // Parse the operation date
      const executedAt = op.fechaOrden ? new Date(op.fechaOrden) : new Date();

      // Calculate quantity (use cantidadOperada if available, otherwise cantidad)
      const quantity = op.cantidadOperada || op.cantidad;

      // Create transaction
      await db.insert(transactions).values({
        userId: user.id,
        assetId: asset.id,
        type: txnType,
        quantity: quantity.toString(),
        pricePerUnit: op.precio.toString(),
        totalAmount: op.montoTotal.toString(),
        currency: mapCurrency(op.mercado),
        executedAt,
        notes: `IOL#${op.numero}`,
      });

      created++;
      console.log(
        `[IOL Transactions] Created: ${txnType} ${quantity} ${ticker} @ ${op.precio}`
      );
    }

    // Update token if it was refreshed
    const newToken = client.getToken();
    if (newToken && newToken.access_token !== token.access_token) {
      await db
        .update(userConnections)
        .set({
          credentials: JSON.stringify(newToken),
          updatedAt: new Date(),
        })
        .where(eq(userConnections.id, connection.id));
    }

    console.log(
      "[IOL Transactions] Done. Created:",
      created,
      "Skipped:",
      skipped
    );

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: operations.length,
    });
  } catch (error) {
    console.error("IOL transactions sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

// GET endpoint to list synced transactions
export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const txns = await db.query.transactions.findMany({
      where: eq(transactions.userId, user.id),
      orderBy: (t, { desc }) => [desc(t.executedAt)],
      limit: 100,
      with: {
        asset: true,
      },
    });

    return NextResponse.json({ transactions: txns });
  } catch (error) {
    console.error("Transactions fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
