// Supabase Edge Function: Portfolio Snapshot
// Triggered daily at market close via pg_cron
// Saves portfolio state for historical tracking and performance charts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
  user_id: string;
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

interface CategoryBreakdown {
  value: number;
  count: number;
  pnl: number;
}

// Convert to USD for consistent calculations
function toUSD(value: number, currency: string, rate: number): number {
  if (currency === "ARS") return value / rate;
  return value;
}

// Calculate portfolio snapshot for a user
function calculateSnapshot(assets: Asset[], usdArsRate: number): {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  assetCount: number;
  byCategory: Record<string, CategoryBreakdown>;
  positions: PositionSnapshot[];
} {
  let totalValue = 0;
  let totalCost = 0;
  const byCategory: Record<string, CategoryBreakdown> = {};
  const positions: PositionSnapshot[] = [];

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

    // Category breakdown
    if (!byCategory[asset.category]) {
      byCategory[asset.category] = { value: 0, count: 0, pnl: 0 };
    }
    byCategory[asset.category].value += value;
    byCategory[asset.category].count += 1;
    byCategory[asset.category].pnl += pnl;

    // Position snapshot
    positions.push({
      ticker: asset.ticker,
      name: asset.name,
      category: asset.category,
      quantity: qty,
      avgPrice: toUSD(avgPrice, asset.currency, usdArsRate),
      currentPrice: toUSD(currentPrice, asset.currency, usdArsRate),
      value,
      pnl,
      pnlPercent,
    });
  }

  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // Sort positions by value descending
  positions.sort((a, b) => b.value - a.value);

  return {
    totalValue,
    totalCost,
    totalPnl,
    totalPnlPercent,
    assetCount: positions.length,
    byCategory,
    positions,
  };
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

    // Fetch exchange rate once before processing users
    const usdArsRate = await getUsdArsRate(supabase);

    // Get today's date (for snapshot_date)
    const today = new Date().toISOString().split("T")[0];

    // Get all users with connected brokers
    const { data: connections, error: connError } = await supabase
      .from("user_connections")
      .select("user_id")
      .in("provider", ["iol", "binance"]);

    if (connError) {
      throw new Error(`Failed to fetch connections: ${connError.message}`);
    }

    // Get unique user IDs
    const userIds = [...new Set((connections as UserConnection[]).map((c) => c.user_id))];

    console.log(`Creating snapshots for ${userIds.length} users`);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        // Check if snapshot already exists for today
        const { data: existing } = await supabase
          .from("portfolio_snapshots")
          .select("id")
          .eq("user_id", userId)
          .eq("snapshot_date", today)
          .single();

        if (existing) {
          console.log(`Snapshot already exists for user ${userId} on ${today}`);
          skipped++;
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
          skipped++;
          continue;
        }

        // Calculate snapshot
        const snapshot = calculateSnapshot(assets as Asset[], usdArsRate);

        // Insert snapshot
        const { error: insertError } = await supabase
          .from("portfolio_snapshots")
          .insert({
            user_id: userId,
            snapshot_date: today,
            total_value_usd: snapshot.totalValue,
            total_cost_usd: snapshot.totalCost,
            total_pnl_usd: snapshot.totalPnl,
            total_pnl_percent: snapshot.totalPnlPercent,
            asset_count: snapshot.assetCount,
            by_category: snapshot.byCategory,
            positions: snapshot.positions,
          });

        if (insertError) {
          console.error(`Failed to insert snapshot for ${userId}:`, insertError);
          failed++;
          continue;
        }

        console.log(`Created snapshot for user ${userId}: $${snapshot.totalValue.toFixed(2)}`);
        created++;
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        users: userIds.length,
        created,
        skipped,
        failed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Portfolio snapshot error:", error);
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
