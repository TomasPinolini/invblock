import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { assetFormSchema } from "@/lib/validators";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.query.assets.findMany({
    where: eq(assets.userId, user.id),
    orderBy: (a, { desc }) => [desc(a.updatedAt)],
    with: { transactions: true },
  });

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = assetFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const { ticker, name, category, currency, quantity, averagePrice } = parsed.data;

  const [row] = await db
    .insert(assets)
    .values({
      userId: user.id,
      ticker,
      name,
      category,
      currency,
      quantity: quantity.toString(),
      averagePrice: averagePrice.toString(),
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
