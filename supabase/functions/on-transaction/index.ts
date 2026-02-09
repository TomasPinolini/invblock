// Supabase Edge Function: On Transaction Insert
// Triggered by database trigger on transactions table
// Recalculates cost basis and checks price alerts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const FROM_EMAIL = "Slock <onboarding@resend.dev>";

interface TransactionPayload {
  transaction_id: string;
  user_id: string;
  asset_id: string;
  type: "buy" | "sell";
  quantity: string;
  price_per_unit: string;
}

interface Asset {
  id: string;
  ticker: string;
  name: string;
  quantity: string;
  average_price: string;
  current_price: string;
  currency: string;
}

interface PriceAlert {
  id: string;
  ticker: string;
  condition: "above" | "below";
  target_price: number;
}

// Send transaction confirmation email
async function sendTransactionEmail(
  to: string,
  type: string,
  ticker: string,
  quantity: number,
  price: number,
  total: number
): Promise<void> {
  if (!RESEND_API_KEY) return;

  const emoji = type === "buy" ? "🟢" : "🔴";
  const action = type === "buy" ? "Bought" : "Sold";
  const subject = `${emoji} ${action} ${quantity} ${ticker} @ $${price.toFixed(2)}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Transaction Confirmed</title></head>
<body style="margin: 0; padding: 20px; background-color: #18181b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #27272a; border-radius: 12px; padding: 24px;">
    <h1 style="color: #fafafa; margin: 0 0 16px; font-size: 20px;">${emoji} Transaction Confirmed</h1>

    <div style="background-color: ${type === "buy" ? "#052e16" : "#450a0a"}; border: 1px solid ${type === "buy" ? "#166534" : "#991b1b"}; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <p style="color: ${type === "buy" ? "#4ade80" : "#f87171"}; margin: 0; font-size: 18px; font-weight: bold;">
        ${action} ${quantity} ${ticker}
      </p>
    </div>

    <div style="display: flex; gap: 12px;">
      <div style="flex: 1; background-color: #3f3f46; border-radius: 8px; padding: 12px; text-align: center;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Price</p>
        <p style="color: #fafafa; margin: 0; font-size: 16px; font-weight: 600;">$${price.toFixed(2)}</p>
      </div>
      <div style="flex: 1; background-color: #3f3f46; border-radius: 8px; padding: 12px; text-align: center;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Total</p>
        <p style="color: #fafafa; margin: 0; font-size: 16px; font-weight: 600;">$${total.toFixed(2)}</p>
      </div>
    </div>
  </div>
  <p style="color: #52525b; margin: 16px 0 0; font-size: 11px; text-align: center;">Sent by Slock</p>
</body>
</html>
  `.trim();

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
  } catch (error) {
    console.error("Failed to send transaction email:", error);
  }
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse the transaction payload from the trigger
    const payload: TransactionPayload = await req.json();
    console.log("Transaction payload:", payload);

    const { transaction_id, user_id, asset_id, type, quantity, price_per_unit } = payload;

    // Get the asset details
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", asset_id)
      .single();

    if (assetError || !asset) {
      throw new Error(`Asset not found: ${asset_id}`);
    }

    const assetData = asset as Asset;
    const qty = parseFloat(quantity);
    const price = parseFloat(price_per_unit);
    const total = qty * price;

    // Get user email for notifications
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users.find((u) => u.id === user_id);
    const userEmail = user?.email;

    // 1. Send transaction confirmation email (optional - can be disabled)
    if (userEmail) {
      await sendTransactionEmail(userEmail, type, assetData.ticker, qty, price, total);
    }

    // 2. Check if any price alerts should be evaluated
    //    (The actual alert triggering is done by the price-alerts function)
    const { data: alerts } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("user_id", user_id)
      .eq("ticker", assetData.ticker)
      .eq("is_active", true);

    if (alerts && alerts.length > 0) {
      console.log(`User has ${alerts.length} active alerts for ${assetData.ticker}`);

      // Update current price in alerts
      for (const alert of alerts as PriceAlert[]) {
        const currentPrice = parseFloat(assetData.current_price);

        await supabase
          .from("price_alerts")
          .update({ current_price: currentPrice })
          .eq("id", alert.id);

        // Check if alert should trigger immediately
        const shouldTrigger =
          (alert.condition === "above" && currentPrice >= alert.target_price) ||
          (alert.condition === "below" && currentPrice <= alert.target_price);

        if (shouldTrigger) {
          console.log(`Alert ${alert.id} triggered for ${assetData.ticker}`);
          await supabase
            .from("price_alerts")
            .update({
              is_active: false,
              triggered_at: new Date().toISOString(),
            })
            .eq("id", alert.id);
        }
      }
    }

    // 3. Log the transaction processing
    console.log(`Processed transaction ${transaction_id}: ${type} ${qty} ${assetData.ticker} @ ${price}`);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id,
        ticker: assetData.ticker,
        type,
        quantity: qty,
        price,
        total,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("On-transaction error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
