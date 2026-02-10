import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAlertSchema, updateAlertSchema, parseBody } from "@/lib/api-schemas";

// GET /api/alerts - List all alerts for current user
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: alerts, error } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch alerts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts });
}

// POST /api/alerts - Create a new alert
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();
  const [body, validationError] = parseBody(createAlertSchema, raw);
  if (validationError) return validationError;

  const { ticker, condition, targetPrice } = body;

  // Get current price from user's assets
  const { data: asset } = await supabase
    .from("assets")
    .select("current_price")
    .eq("user_id", user.id)
    .eq("ticker", ticker)
    .single();

  const { data: alert, error } = await supabase
    .from("price_alerts")
    .insert({
      user_id: user.id,
      ticker,
      condition,
      target_price: targetPrice,
      current_price: asset?.current_price || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create alert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alert });
}

// PATCH /api/alerts - Update an alert
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();
  const [body, validationError] = parseBody(updateAlertSchema, raw);
  if (validationError) return validationError;

  const { id, condition, targetPrice } = body;

  // Verify ownership
  const { data: existing } = await supabase
    .from("price_alerts")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  // Build update object
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (condition) updates.condition = condition;
  if (targetPrice !== undefined) updates.target_price = targetPrice;

  const { data: alert, error } = await supabase
    .from("price_alerts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update alert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alert });
}

// DELETE /api/alerts?id=xxx - Delete an alert
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alertId = req.nextUrl.searchParams.get("id");

  if (!alertId) {
    return NextResponse.json(
      { error: "Missing alert id" },
      { status: 400 }
    );
  }

  // Verify ownership before deleting
  const { data: existing } = await supabase
    .from("price_alerts")
    .select("id")
    .eq("id", alertId)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: "Alert not found" },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from("price_alerts")
    .delete()
    .eq("id", alertId);

  if (error) {
    console.error("Failed to delete alert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
