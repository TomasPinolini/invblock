// Supabase Edge Function: MEP Rate Calculator
// Fetches USD/ARS exchange rates from dolarapi.com and upserts into exchange_rates table
// Schedule via pg_cron (e.g. every 30 minutes during market hours)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FETCH_TIMEOUT = 10_000; // 10 seconds

interface DolarApiResponse {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

interface RateResult {
  pair: string;
  source: string;
  buyRate: number;
  sellRate: number;
  sourceUpdatedAt: string | null;
}

async function fetchRate(
  url: string,
  pair: string
): Promise<RateResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Failed to fetch ${pair}: HTTP ${response.status}`);
      return null;
    }

    const data: DolarApiResponse = await response.json();

    if (!data.compra || !data.venta) {
      console.error(`Invalid response for ${pair}: missing compra/venta`);
      return null;
    }

    return {
      pair,
      source: "dolarapi",
      buyRate: data.compra,
      sellRate: data.venta,
      sourceUpdatedAt: data.fechaActualizacion || null,
    };
  } catch (error) {
    console.error(`Error fetching ${pair}:`, error);
    return null;
  }
}

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

    // Fetch both rates in parallel
    const [blue, mep] = await Promise.all([
      fetchRate("https://dolarapi.com/v1/dolares/blue", "USD_ARS_BLUE"),
      fetchRate("https://dolarapi.com/v1/dolares/bolsa", "USD_ARS_MEP"),
    ]);

    const results: { pair: string; sellRate: number }[] = [];
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (const rate of [blue, mep]) {
      if (!rate) continue;

      const { error } = await supabase.from("exchange_rates").upsert(
        {
          pair: rate.pair,
          source: rate.source,
          buy_rate: rate.buyRate,
          sell_rate: rate.sellRate,
          fetched_at: now,
          source_updated_at: rate.sourceUpdatedAt,
          updated_at: now,
        },
        { onConflict: "pair" }
      );

      if (error) {
        console.error(`Failed to upsert ${rate.pair}:`, error);
        errors.push(`${rate.pair}: ${error.message}`);
      } else {
        console.log(
          `Upserted ${rate.pair}: buy=${rate.buyRate}, sell=${rate.sellRate}`
        );
        results.push({ pair: rate.pair, sellRate: rate.sellRate });
      }
    }

    if (results.length === 0 && errors.length > 0) {
      throw new Error(`All upserts failed: ${errors.join("; ")}`);
    }

    if (!blue && !mep) {
      console.warn("Both API calls failed — no rates written");
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: results,
        errors: errors.length > 0 ? errors : undefined,
        fetchedAt: now,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("MEP rate calculator error:", error);
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
