// Supabase Edge Function: Weekly Portfolio Digest
// Triggered weekly (Friday after market close) via pg_cron or manually via HTTP
// Pulls last 5-7 daily snapshots, computes weekly deltas, gets AI summary, sends styled email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Email configuration
const FROM_EMAIL = "Slock <reports@yourdomain.com>";

interface UserConnection {
  user_id: string;
  provider: string;
}

interface PositionSnapshot {
  ticker: string;
  name: string;
  category: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

interface PortfolioSnapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  total_value_usd: number;
  total_cost_usd: number;
  total_pnl_usd: number;
  total_pnl_percent: number;
  asset_count: number;
  by_category: Record<string, { value: number; count: number; pnl: number }>;
  positions: PositionSnapshot[];
}

interface Mover {
  ticker: string;
  name: string;
  category: string;
  startValue: number;
  endValue: number;
  changeUsd: number;
  changePercent: number;
}

interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  startValue: number;
  endValue: number;
  weeklyChangeUsd: number;
  weeklyChangePercent: number;
  startPnlPercent: number;
  endPnlPercent: number;
  snapshotCount: number;
  assetCount: number;
  biggestGainers: Mover[];
  biggestLosers: Mover[];
  categoryShifts: { category: string; startValue: number; endValue: number; changePercent: number }[];
  trend: string;
}

// Format currency for email
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Format percent
function formatPercent(value: number, includeSign = true): string {
  const sign = includeSign && value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// Compute weekly data from snapshots
function computeWeeklyData(snapshots: PortfolioSnapshot[]): WeeklyData {
  // snapshots are ordered DESC by date — oldest is last
  const newest = snapshots[0];
  const oldest = snapshots[snapshots.length - 1];

  const startValue = oldest.total_value_usd;
  const endValue = newest.total_value_usd;
  const weeklyChangeUsd = endValue - startValue;
  const weeklyChangePercent = startValue > 0 ? (weeklyChangeUsd / startValue) * 100 : 0;

  // Determine trend from intermediate snapshots
  let upDays = 0;
  let downDays = 0;
  for (let i = 0; i < snapshots.length - 1; i++) {
    const diff = snapshots[i].total_value_usd - snapshots[i + 1].total_value_usd;
    if (diff > 0) upDays++;
    else if (diff < 0) downDays++;
  }

  let trend: string;
  if (upDays > downDays + 1) trend = "consistently_up";
  else if (downDays > upDays + 1) trend = "consistently_down";
  else if (weeklyChangeUsd > 0) trend = "mixed_up";
  else if (weeklyChangeUsd < 0) trend = "mixed_down";
  else trend = "flat";

  // Compare positions between oldest and newest snapshots to find biggest movers
  const oldPositions = new Map<string, PositionSnapshot>();
  for (const pos of oldest.positions || []) {
    oldPositions.set(pos.ticker, pos);
  }

  const movers: Mover[] = [];
  for (const pos of newest.positions || []) {
    const oldPos = oldPositions.get(pos.ticker);
    const startVal = oldPos ? oldPos.value : 0;
    const endVal = pos.value;
    const changeUsd = endVal - startVal;
    const changePercent = startVal > 0 ? (changeUsd / startVal) * 100 : (endVal > 0 ? 100 : 0);

    movers.push({
      ticker: pos.ticker,
      name: pos.name,
      category: pos.category,
      startValue: startVal,
      endValue: endVal,
      changeUsd,
      changePercent,
    });
  }

  // Also include positions that existed in old but not in new (sold/removed)
  for (const [ticker, oldPos] of oldPositions) {
    const existsInNew = (newest.positions || []).some((p: PositionSnapshot) => p.ticker === ticker);
    if (!existsInNew) {
      movers.push({
        ticker: oldPos.ticker,
        name: oldPos.name,
        category: oldPos.category,
        startValue: oldPos.value,
        endValue: 0,
        changeUsd: -oldPos.value,
        changePercent: -100,
      });
    }
  }

  // Sort by absolute change in USD
  movers.sort((a, b) => Math.abs(b.changeUsd) - Math.abs(a.changeUsd));

  const biggestGainers = movers
    .filter((m) => m.changeUsd > 0)
    .slice(0, 3);

  const biggestLosers = movers
    .filter((m) => m.changeUsd < 0)
    .slice(0, 3);

  // Category shifts
  const oldCategories = oldest.by_category || {};
  const newCategories = newest.by_category || {};
  const allCategories = new Set([...Object.keys(oldCategories), ...Object.keys(newCategories)]);

  const categoryShifts = Array.from(allCategories).map((category) => {
    const startVal = oldCategories[category]?.value || 0;
    const endVal = newCategories[category]?.value || 0;
    const changePct = startVal > 0 ? ((endVal - startVal) / startVal) * 100 : (endVal > 0 ? 100 : 0);
    return { category, startValue: startVal, endValue: endVal, changePercent: changePct };
  }).sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  return {
    weekStart: oldest.snapshot_date,
    weekEnd: newest.snapshot_date,
    startValue,
    endValue,
    weeklyChangeUsd,
    weeklyChangePercent,
    startPnlPercent: oldest.total_pnl_percent,
    endPnlPercent: newest.total_pnl_percent,
    snapshotCount: snapshots.length,
    assetCount: newest.asset_count,
    biggestGainers,
    biggestLosers,
    categoryShifts,
    trend,
  };
}

// Call Claude API for AI summary
async function getAISummary(weeklyData: WeeklyData): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not configured, skipping AI summary");
    return "";
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 500,
        temperature: 0.4,
        system:
          "You are a concise Argentine retail investment analyst. Write a 3-4 sentence weekly portfolio summary in English. Focus on: what moved most, why it matters, and one actionable observation. Be specific with numbers. No greetings or sign-offs.",
        messages: [
          {
            role: "user",
            content: `Weekly portfolio data:\n${JSON.stringify(weeklyData)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      return "";
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || "";
    return text.trim();
  } catch (error) {
    console.error("Failed to get AI summary:", error);
    return "";
  }
}

// Send email via Resend
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

// Generate styled HTML email
function generateEmailHTML(weeklyData: WeeklyData, aiSummary: string): string {
  const changeColor = weeklyData.weeklyChangeUsd >= 0 ? "#10b981" : "#ef4444";
  const changeSign = weeklyData.weeklyChangeUsd >= 0 ? "+" : "";

  // Format the week range
  const weekRange = `${weeklyData.weekStart} to ${weeklyData.weekEnd}`;

  // Build movers HTML
  function moverRow(mover: Mover, isGainer: boolean): string {
    const color = isGainer ? "#10b981" : "#ef4444";
    const sign = mover.changeUsd >= 0 ? "+" : "";
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #3f3f46;">
        <div>
          <span style="color: #fafafa; font-weight: 500;">${mover.ticker}</span>
          <span style="color: #71717a; font-size: 12px; margin-left: 6px;">${mover.category}</span>
        </div>
        <div style="text-align: right;">
          <span style="color: ${color}; font-family: 'SF Mono', Monaco, monospace; font-size: 14px;">
            ${sign}${formatCurrency(mover.changeUsd)}
          </span>
          <span style="color: ${color}; font-size: 12px; opacity: 0.8; margin-left: 4px;">
            (${formatPercent(mover.changePercent)})
          </span>
        </div>
      </div>`;
  }

  const gainersHTML =
    weeklyData.biggestGainers.length > 0
      ? `
    <div style="background-color: #27272a; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
      <p style="color: #10b981; margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Top Gainers</p>
      ${weeklyData.biggestGainers.map((g) => moverRow(g, true)).join("")}
    </div>`
      : "";

  const losersHTML =
    weeklyData.biggestLosers.length > 0
      ? `
    <div style="background-color: #27272a; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
      <p style="color: #ef4444; margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Top Losers</p>
      ${weeklyData.biggestLosers.map((l) => moverRow(l, false)).join("")}
    </div>`
      : "";

  // AI summary block
  const aiBlock = aiSummary
    ? `
    <div style="background-color: #27272a; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 3px solid #6366f1;">
      <p style="color: #a1a1aa; margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">AI Analysis</p>
      <p style="color: #e4e4e7; margin: 0; font-size: 14px; line-height: 1.6;">${aiSummary}</p>
    </div>`
    : "";

  // Category breakdown
  const categoryRows = weeklyData.categoryShifts
    .filter((c) => c.endValue > 0 || c.startValue > 0)
    .slice(0, 5)
    .map((c) => {
      const catColor = c.changePercent >= 0 ? "#10b981" : "#ef4444";
      const catSign = c.changePercent >= 0 ? "+" : "";
      return `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #3f3f46;">
          <span style="color: #fafafa; font-size: 13px; text-transform: capitalize;">${c.category}</span>
          <div>
            <span style="color: #a1a1aa; font-family: 'SF Mono', Monaco, monospace; font-size: 13px;">${formatCurrency(c.endValue)}</span>
            <span style="color: ${catColor}; font-family: 'SF Mono', Monaco, monospace; font-size: 12px; margin-left: 8px;">${catSign}${c.changePercent.toFixed(1)}%</span>
          </div>
        </div>`;
    })
    .join("");

  const categoryBlock =
    categoryRows.length > 0
      ? `
    <div style="background-color: #27272a; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
      <p style="color: #a1a1aa; margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Category Breakdown</p>
      ${categoryRows}
    </div>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Portfolio Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #18181b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="text-align: center; padding: 20px 0; border-bottom: 1px solid #3f3f46;">
      <h1 style="color: #fafafa; margin: 0; font-size: 24px;">Weekly Portfolio Digest</h1>
      <p style="color: #a1a1aa; margin: 8px 0 0; font-size: 14px;">${weekRange}</p>
    </div>

    <!-- Main Stats -->
    <div style="padding: 24px 0; text-align: center;">
      <p style="color: #a1a1aa; margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Portfolio Value</p>
      <p style="color: #fafafa; margin: 0; font-size: 36px; font-weight: bold; font-family: 'SF Mono', Monaco, monospace;">
        ${formatCurrency(weeklyData.endValue)}
      </p>
    </div>

    <!-- Weekly Change Card -->
    <div style="background-color: #27272a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <p style="color: #a1a1aa; margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Weekly Change</p>
      <p style="color: ${changeColor}; margin: 0; font-size: 28px; font-weight: bold; font-family: 'SF Mono', Monaco, monospace;">
        ${changeSign}${formatCurrency(Math.abs(weeklyData.weeklyChangeUsd))}
        <span style="font-size: 18px; opacity: 0.8;">(${changeSign}${weeklyData.weeklyChangePercent.toFixed(2)}%)</span>
      </p>
    </div>

    <!-- Stats Row -->
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background-color: #27272a; border-radius: 12px; padding: 16px; text-align: center;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Positions</p>
        <p style="color: #fafafa; margin: 0; font-size: 16px; font-weight: 600;">
          ${weeklyData.assetCount}
        </p>
      </div>
      <div style="flex: 1; background-color: #27272a; border-radius: 12px; padding: 16px; text-align: center;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Total P&L</p>
        <p style="color: ${weeklyData.endPnlPercent >= 0 ? "#10b981" : "#ef4444"}; margin: 0; font-size: 16px; font-weight: 600; font-family: 'SF Mono', Monaco, monospace;">
          ${weeklyData.endPnlPercent >= 0 ? "+" : ""}${weeklyData.endPnlPercent.toFixed(2)}%
        </p>
      </div>
      <div style="flex: 1; background-color: #27272a; border-radius: 12px; padding: 16px; text-align: center;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Snapshots</p>
        <p style="color: #fafafa; margin: 0; font-size: 16px; font-weight: 600;">
          ${weeklyData.snapshotCount}
        </p>
      </div>
    </div>

    ${aiBlock}

    ${gainersHTML}

    ${losersHTML}

    ${categoryBlock}

    <!-- Footer -->
    <div style="text-align: center; padding: 20px 0; border-top: 1px solid #3f3f46;">
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        Sent by Slock Financial Command Center
      </p>
      <p style="color: #52525b; margin: 8px 0 0; font-size: 11px;">
        Market data may be delayed. This is not financial advice.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Main handler
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all users with connected brokers
    const { data: connections, error: connError } = await supabase
      .from("user_connections")
      .select("user_id, provider")
      .in("provider", ["iol", "binance"]);

    if (connError) {
      throw new Error(`Failed to fetch connections: ${connError.message}`);
    }

    // Get unique user IDs
    const userIds = [
      ...new Set(
        (connections as UserConnection[]).map((c) => c.user_id)
      ),
    ];

    console.log(
      `[weekly-digest] Processing ${userIds.length} users with connected brokers`
    );

    // Get user emails from auth.users
    const { data: users, error: usersError } =
      await supabase.auth.admin.listUsers();

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const userEmails = new Map(
      users.users.map((u: { id: string; email?: string }) => [u.id, u.email])
    );

    // Calculate date range: last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const today = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const userId of userIds) {
      try {
        const email = userEmails.get(userId);
        if (!email) {
          console.log(`[weekly-digest] No email found for user ${userId}`);
          skipped++;
          continue;
        }

        // Query last 7 days of snapshots
        const { data: snapshots, error: snapError } = await supabase
          .from("portfolio_snapshots")
          .select("*")
          .eq("user_id", userId)
          .gte("snapshot_date", sevenDaysAgoStr)
          .order("snapshot_date", { ascending: false });

        if (snapError) {
          console.error(
            `[weekly-digest] Failed to fetch snapshots for ${userId}:`,
            snapError
          );
          failed++;
          continue;
        }

        if (!snapshots || snapshots.length < 2) {
          console.log(
            `[weekly-digest] Not enough snapshots for user ${userId} (${snapshots?.length || 0} found, need at least 2)`
          );
          skipped++;
          continue;
        }

        console.log(
          `[weekly-digest] User ${userId}: ${snapshots.length} snapshots found`
        );

        // Compute weekly data
        const weeklyData = computeWeeklyData(snapshots as PortfolioSnapshot[]);

        // Get AI summary
        const aiSummary = await getAISummary(weeklyData);
        if (aiSummary) {
          console.log(`[weekly-digest] AI summary generated for user ${userId}`);
        } else {
          console.log(
            `[weekly-digest] No AI summary for user ${userId} (API key missing or error)`
          );
        }

        // Generate styled email
        const html = generateEmailHTML(weeklyData, aiSummary);

        // Build subject line
        const changeSign = weeklyData.weeklyChangeUsd >= 0 ? "+" : "";
        const subject = `Weekly Digest: ${formatCurrency(weeklyData.endValue)} | ${changeSign}${weeklyData.weeklyChangePercent.toFixed(2)}% this week`;

        // Send email
        const success = await sendEmail(email, subject, html);

        if (success) {
          sent++;
          console.log(`[weekly-digest] Email sent to ${email}`);
        } else {
          failed++;
          console.log(`[weekly-digest] Failed to send email to ${email}`);
        }
      } catch (error) {
        console.error(
          `[weekly-digest] Error processing user ${userId}:`,
          error
        );
        failed++;
      }
    }

    console.log(
      `[weekly-digest] Complete: ${sent} sent, ${failed} failed, ${skipped} skipped`
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed: userIds.length,
        sent,
        failed,
        skipped,
        date: today,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[weekly-digest] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
