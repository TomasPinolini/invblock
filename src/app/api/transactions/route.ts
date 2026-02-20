import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, assets } from "@/db/schema";
import { transactionInsertSchema } from "@/lib/validators";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");

  const whereClause = assetId
    ? and(eq(transactions.userId, user.id), eq(transactions.assetId, assetId))
    : eq(transactions.userId, user.id);

  const rows = await db.query.transactions.findMany({
    where: whereClause,
    orderBy: (t, { desc }) => [desc(t.executedAt)],
    with: { asset: true },
  });

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = transactionInsertSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const { assetId, type, quantity, pricePerUnit, totalAmount, currency, notes } =
    parsed.data;

  // Wrap asset read + transaction insert + asset update in a DB transaction
  // to prevent race conditions on concurrent requests for the same asset
  const result = await db.transaction(async (tx) => {
    // Verify asset belongs to user (read within transaction)
    const asset = await tx.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.userId, user.id)),
    });

    if (!asset) return null;

    // Create transaction
    const [txn] = await tx
      .insert(transactions)
      .values({
        userId: user.id,
        assetId,
        type,
        quantity: quantity.toString(),
        pricePerUnit: pricePerUnit.toString(),
        totalAmount: totalAmount.toString(),
        currency,
        notes,
      })
      .returning();

    // Update asset quantity and average price
    const currentQty = Number(asset.quantity);
    const currentAvgPrice = Number(asset.averagePrice);

    let newQty: number;
    let newAvgPrice: number;

    if (type === "buy") {
      const totalCost = currentQty * currentAvgPrice + quantity * pricePerUnit;
      newQty = currentQty + quantity;
      newAvgPrice = newQty > 0 ? totalCost / newQty : 0;
    } else {
      // sell
      newQty = Math.max(0, currentQty - quantity);
      newAvgPrice = currentAvgPrice; // Average price doesn't change on sell
    }

    await tx
      .update(assets)
      .set({
        quantity: newQty.toString(),
        averagePrice: newAvgPrice.toString(),
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId));

    return txn;
  });

  if (!result) {
    return NextResponse.json({ message: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 201 });
}
