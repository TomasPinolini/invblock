// Supabase Edge Function: Price Alert Notifications
// Triggered every 15 min during market hours via pg_cron
// Checks user-defined price thresholds and sends notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FROM_EMAIL = "Slock <onboarding@resend.dev>";

interface PriceAlert {
  id: string;
  user_id: string;
  ticker: string;
  condition: "above" | "below";
  target_price: number;
  current_price: number | null;
  is_active: boolean;
}

interface Asset {
  ticker: string;
  current_price: string;
}

// Send alert email
async function sendAlertEmail(
  to: string,
  ticker: string,
  condition: string,
  targetPrice: number,
  currentPrice: number
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return false;
  }

  const subject = `🚨 Price Alert: ${ticker} is ${condition} $${targetPrice.toFixed(2)}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Price Alert</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #18181b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #27272a; border-radius: 12px; padding: 24px;">
    <h1 style="color: #fafafa; margin: 0 0 16px; font-size: 20px;">🚨 Price Alert Triggered</h1>

    <div style="background-color: #3f3f46; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 12px; text-transform: uppercase;">Ticker</p>
      <p style="color: #fafafa; margin: 0; font-size: 24px; font-weight: bold;">${ticker}</p>
    </div>

    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
      <div style="flex: 1; background-color: #3f3f46; border-radius: 8px; padding: 12px;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Target</p>
        <p style="color: #fafafa; margin: 0; font-size: 18px; font-weight: 600;">$${targetPrice.toFixed(2)}</p>
      </div>
      <div style="flex: 1; background-color: #3f3f46; border-radius: 8px; padding: 12px;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Current</p>
        <p style="color: ${condition === "above" ? "#10b981" : "#ef4444"}; margin: 0; font-size: 18px; font-weight: 600;">$${currentPrice.toFixed(2)}</p>
      </div>
    </div>

    <p style="color: #71717a; margin: 0; font-size: 12px; text-align: center;">
      ${ticker} is now <strong>${condition}</strong> your target of $${targetPrice.toFixed(2)}
    </p>
  </div>

  <p style="color: #52525b; margin: 16px 0 0; font-size: 11px; text-align: center;">
    Sent by Slock Financial Command Center
  </p>
</body>
</html>
  `.trim();

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to send alert email:", error);
    return false;
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

    // Get all active price alerts
    const { data: alerts, error: alertsError } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("is_active", true);

    if (alertsError) {
      throw new Error(`Failed to fetch alerts: ${alertsError.message}`);
    }

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active alerts", checked: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking ${alerts.length} active price alerts`);

    // Get unique tickers from alerts
    const tickers = [...new Set((alerts as PriceAlert[]).map((a) => a.ticker))];

    // Fetch current prices from assets table
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("ticker, current_price")
      .in("ticker", tickers);

    if (assetsError) {
      throw new Error(`Failed to fetch prices: ${assetsError.message}`);
    }

    // Build price map
    const priceMap = new Map<string, number>();
    for (const asset of (assets as Asset[]) || []) {
      priceMap.set(asset.ticker, parseFloat(asset.current_price) || 0);
    }

    // Get user emails
    const userIds = [...new Set((alerts as PriceAlert[]).map((a) => a.user_id))];
    const { data: users } = await supabase.auth.admin.listUsers();
    const userEmails = new Map(users?.users.map((u) => [u.id, u.email]) || []);

    let triggered = 0;
    let checked = 0;

    for (const alert of alerts as PriceAlert[]) {
      checked++;
      const currentPrice = priceMap.get(alert.ticker);

      if (currentPrice === undefined) {
        console.log(`No price found for ${alert.ticker}`);
        continue;
      }

      // Update current price in alert
      await supabase
        .from("price_alerts")
        .update({ current_price: currentPrice, updated_at: new Date().toISOString() })
        .eq("id", alert.id);

      // Check if alert should trigger
      const shouldTrigger =
        (alert.condition === "above" && currentPrice >= alert.target_price) ||
        (alert.condition === "below" && currentPrice <= alert.target_price);

      if (shouldTrigger) {
        console.log(`Alert triggered: ${alert.ticker} ${alert.condition} ${alert.target_price} (current: ${currentPrice})`);

        // Mark as triggered
        await supabase
          .from("price_alerts")
          .update({
            is_active: false,
            triggered_at: new Date().toISOString(),
          })
          .eq("id", alert.id);

        // Send notification
        const email = userEmails.get(alert.user_id);
        if (email) {
          await sendAlertEmail(
            email,
            alert.ticker,
            alert.condition,
            alert.target_price,
            currentPrice
          );
        }

        triggered++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked,
        triggered,
        tickers: tickers.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Price alerts error:", error);
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
