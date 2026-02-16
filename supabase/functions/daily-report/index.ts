// Supabase Edge Function: Daily Market Close Report
// Triggered via pg_cron at market close or manually via HTTP
// Sends portfolio summary email to users with connected brokers

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Email configuration
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "tomaspinolini2003@gmail.com";
const SENDER_NAME = Deno.env.get("SENDER_NAME") || "Slock";
const APP_URL = Deno.env.get("APP_URL") || "https://invblock.vercel.app";
const FALLBACK_USD_ARS_RATE = 1250;

// Fetch USD/ARS sell rate from exchange_rates table, fallback to hardcoded rate
async function getUsdArsRate(
  supabase: ReturnType<typeof createClient>
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("exchange_rates")
      .select("sell_rate, fetched_at")
      .eq("pair", "USD_ARS_BLUE")
      .single();

    if (error || !data) {
      console.warn(
        `No exchange rate found, using fallback: ${FALLBACK_USD_ARS_RATE}`
      );
      return FALLBACK_USD_ARS_RATE;
    }

    const rate = parseFloat(data.sell_rate);
    if (!rate || rate <= 0) {
      console.warn(
        `Invalid exchange rate value, using fallback: ${FALLBACK_USD_ARS_RATE}`
      );
      return FALLBACK_USD_ARS_RATE;
    }

    // Warn if rate is stale (> 24h old)
    const fetchedAt = new Date(data.fetched_at);
    const ageMs = Date.now() - fetchedAt.getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      console.warn(
        `Exchange rate is stale (${Math.round(ageMs / 3600000)}h old), using anyway: ${rate}`
      );
    } else {
      console.log(`Using USD/ARS rate: ${rate} (fetched ${Math.round(ageMs / 60000)}m ago)`);
    }

    return rate;
  } catch (err) {
    console.error("Error fetching exchange rate:", err);
    return FALLBACK_USD_ARS_RATE;
  }
}

interface Asset {
  id: string;
  ticker: string;
  name: string;
  category: string;
  currency: string;
  quantity: string;
  average_price: string;
  current_price: string;
}

interface UserConnection {
  user_id: string;
  provider: string;
}

interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  topGainers: { ticker: string; pnlPercent: number }[];
  topLosers: { ticker: string; pnlPercent: number }[];
  assetCount: number;
}

// Format currency for email
function formatCurrency(value: number, currency: string): string {
  const decimals = currency === "ARS" ? 0 : 2;
  return new Intl.NumberFormat(currency === "ARS" ? "es-AR" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Convert to USD for consistent calculations
function toUSD(value: number, currency: string, rate: number): number {
  if (currency === "ARS") return value / rate;
  return value;
}

// Calculate portfolio summary for a user
function calculateSummary(assets: Asset[], usdArsRate: number): PortfolioSummary {
  let totalValue = 0;
  let totalCost = 0;

  const assetPnls: { ticker: string; pnl: number; pnlPercent: number }[] = [];

  for (const asset of assets) {
    const qty = parseFloat(asset.quantity) || 0;
    const avgPrice = parseFloat(asset.average_price) || 0;
    const currentPrice = parseFloat(asset.current_price) || 0;

    if (qty <= 0) continue;

    const cost = toUSD(qty * avgPrice, asset.currency, usdArsRate);
    const value = toUSD(qty * currentPrice, asset.currency, usdArsRate);
    const pnl = value - cost;
    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

    totalCost += cost;
    totalValue += value;

    assetPnls.push({ ticker: asset.ticker, pnl, pnlPercent });
  }

  // Sort by P&L percent
  assetPnls.sort((a, b) => b.pnlPercent - a.pnlPercent);

  const topGainers = assetPnls
    .filter((a) => a.pnlPercent > 0)
    .slice(0, 3)
    .map(({ ticker, pnlPercent }) => ({ ticker, pnlPercent }));

  const topLosers = assetPnls
    .filter((a) => a.pnlPercent < 0)
    .slice(-3)
    .reverse()
    .map(({ ticker, pnlPercent }) => ({ ticker, pnlPercent }));

  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalPnl,
    totalPnlPercent,
    topGainers,
    topLosers,
    assetCount: assets.filter((a) => parseFloat(a.quantity) > 0).length,
  };
}

// Generate HTML email content
function generateEmailHTML(
  summary: PortfolioSummary,
  date: string
): string {
  const pnlColor = summary.totalPnl >= 0 ? "#10b981" : "#ef4444";
  const pnlSign = summary.totalPnl >= 0 ? "+" : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Portfolio Report</title>
</head>
<body style="margin: 0; padding: 0; background-color: #18181b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="text-align: center; padding: 20px 0; border-bottom: 1px solid #3f3f46;">
      <h1 style="color: #fafafa; margin: 0; font-size: 24px;">📊 Daily Portfolio Report</h1>
      <p style="color: #a1a1aa; margin: 8px 0 0; font-size: 14px;">${date}</p>
    </div>

    <!-- Main Stats -->
    <div style="padding: 24px 0; text-align: center;">
      <p style="color: #a1a1aa; margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Total Portfolio Value</p>
      <p style="color: #fafafa; margin: 0; font-size: 36px; font-weight: bold; font-family: 'SF Mono', Monaco, monospace;">
        ${formatCurrency(summary.totalValue, "USD")}
      </p>
    </div>

    <!-- P&L Card -->
    <div style="background-color: #27272a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <p style="color: #a1a1aa; margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Total Return</p>
      <p style="color: ${pnlColor}; margin: 0; font-size: 28px; font-weight: bold; font-family: 'SF Mono', Monaco, monospace;">
        ${pnlSign}${formatCurrency(Math.abs(summary.totalPnl), "USD")}
        <span style="font-size: 18px; opacity: 0.8;">(${pnlSign}${summary.totalPnlPercent.toFixed(2)}%)</span>
      </p>
    </div>

    <!-- Stats Row -->
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background-color: #27272a; border-radius: 12px; padding: 16px; text-align: center;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Cost Basis</p>
        <p style="color: #fafafa; margin: 0; font-size: 16px; font-weight: 600; font-family: 'SF Mono', Monaco, monospace;">
          ${formatCurrency(summary.totalCost, "USD")}
        </p>
      </div>
      <div style="flex: 1; background-color: #27272a; border-radius: 12px; padding: 16px; text-align: center;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Positions</p>
        <p style="color: #fafafa; margin: 0; font-size: 16px; font-weight: 600;">
          ${summary.assetCount}
        </p>
      </div>
    </div>

    ${
      summary.topGainers.length > 0
        ? `
    <!-- Top Gainers -->
    <div style="background-color: #27272a; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
      <p style="color: #10b981; margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">📈 Top Gainers</p>
      ${summary.topGainers
        .map(
          (g) => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #3f3f46;">
          <span style="color: #fafafa; font-weight: 500;">${g.ticker}</span>
          <span style="color: #10b981; font-family: 'SF Mono', Monaco, monospace;">+${g.pnlPercent.toFixed(2)}%</span>
        </div>
      `
        )
        .join("")}
    </div>
    `
        : ""
    }

    ${
      summary.topLosers.length > 0
        ? `
    <!-- Top Losers -->
    <div style="background-color: #27272a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
      <p style="color: #ef4444; margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">📉 Top Losers</p>
      ${summary.topLosers
        .map(
          (l) => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #3f3f46;">
          <span style="color: #fafafa; font-weight: 500;">${l.ticker}</span>
          <span style="color: #ef4444; font-family: 'SF Mono', Monaco, monospace;">${l.pnlPercent.toFixed(2)}%</span>
        </div>
      `
        )
        .join("")}
    </div>
    `
        : ""
    }

    <!-- Footer -->
    <div style="text-align: center; padding: 20px 0; border-top: 1px solid #3f3f46;">
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        Sent by Slock Financial Command Center
      </p>
      <p style="color: #52525b; margin: 8px 0 0; font-size: 11px;">
        Market data may be delayed. This is not financial advice.
      </p>
    </div>
    <div style="margin-top:32px; padding-top:16px; border-top:1px solid #27272a; text-align:center;">
      <p style="color:#71717a; font-size:12px; margin:0;">
        You're receiving this because you have an account on Slock.
        <a href="${APP_URL}/settings#notifications" style="color:#60a5fa; text-decoration:underline;">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Send email via Brevo
async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!BREVO_API_KEY) {
    console.error("BREVO_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Brevo API error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

// Main handler
serve(async (req) => {
  // CORS headers
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

    // Fetch exchange rate once before processing users
    const usdArsRate = await getUsdArsRate(supabase);

    // Get all users with connected brokers
    const { data: connections, error: connError } = await supabase
      .from("user_connections")
      .select("user_id, provider")
      .in("provider", ["iol", "binance"]);

    if (connError) {
      throw new Error(`Failed to fetch connections: ${connError.message}`);
    }

    // Get unique user IDs
    const userIds = [...new Set((connections as UserConnection[]).map((c) => c.user_id))];

    console.log(`Processing ${userIds.length} users with connected brokers`);

    // Get user emails from auth.users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const userEmails = new Map(
      users.users.map((u) => [u.id, u.email])
    );

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let sent = 0;
    let failed = 0;

    for (const userId of userIds) {
      const email = userEmails.get(userId);
      if (!email) {
        console.log(`No email found for user ${userId}`);
        continue;
      }

      // Check email preferences (opt-out model: default to true if no row)
      const { data: prefs } = await supabase
        .from("user_email_preferences")
        .select("daily_report")
        .eq("user_id", userId)
        .single();

      if (prefs && prefs.daily_report === false) {
        console.log(`User ${userId} opted out of daily reports, skipping`);
        continue;
      }

      // Get user's assets
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("*")
        .eq("user_id", userId);

      if (assetsError) {
        console.error(`Failed to fetch assets for ${userId}:`, assetsError);
        failed++;
        continue;
      }

      if (!assets || assets.length === 0) {
        console.log(`No assets for user ${userId}`);
        continue;
      }

      // Calculate summary
      const summary = calculateSummary(assets as Asset[], usdArsRate);

      // Generate and send email
      const html = generateEmailHTML(summary, today);
      const subject = `📊 Portfolio: ${formatCurrency(summary.totalValue, "USD")} | ${
        summary.totalPnl >= 0 ? "+" : ""
      }${summary.totalPnlPercent.toFixed(2)}%`;

      const success = await sendEmail(email, subject, html);

      if (success) {
        sent++;
        console.log(`Email sent to ${email}`);
      } else {
        failed++;
        console.log(`Failed to send email to ${email}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: userIds.length,
        sent,
        failed,
        date: today,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Daily report error:", error);
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
