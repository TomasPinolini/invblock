// Supabase Edge Function: Watchlist Price Sync
// Triggered every 15-30 min during market hours via pg_cron or manually via HTTP
// Aggregates all unique tickers across watchlist + assets tables,
// fetches current prices from Yahoo Finance, and upserts into ticker_price_cache

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const YAHOO_QUOTE_URL = "https://query2.finance.yahoo.com/v7/finance/quote";
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 15000;

// ── Types ───────────────────────────────────────────────────────────────────

interface TickerRow {
  ticker: string;
  category: string;
}

interface YahooQuoteResult {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  currency: string;
}

interface YahooResponse {
  quoteResponse: {
    result: YahooQuoteResult[];
    error: null | { code: string; description: string };
  };
}

// ── Ticker → Yahoo Symbol Mapping ───────────────────────────────────────────

function toYahooSymbol(ticker: string, category: string): string | null {
  switch (category) {
    case "cedear":
      return `${ticker}.BA`;
    case "stock":
      // US stocks — use as-is
      return ticker;
    case "crypto":
      return `${ticker}-USD`;
    case "cash":
      // No price needed for cash positions
      return null;
    default:
      // Unknown category — try as-is
      return ticker;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Fetch a batch of quotes from Yahoo Finance v7 ───────────────────────────

async function fetchYahooBatch(
  symbols: string[]
): Promise<YahooQuoteResult[]> {
  const url = `${YAHOO_QUOTE_URL}?symbols=${symbols.join(",")}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (response.status === 429) {
      console.warn(
        `Yahoo rate limit hit (429) for batch: ${symbols.slice(0, 3).join(", ")}...`
      );
      return [];
    }

    if (!response.ok) {
      console.error(
        `Yahoo API error: ${response.status} ${response.statusText} for batch: ${symbols.slice(0, 3).join(", ")}...`
      );
      return [];
    }

    const data: YahooResponse = await response.json();

    if (data.quoteResponse.error) {
      console.error(
        `Yahoo response error: ${data.quoteResponse.error.description}`
      );
      return [];
    }

    return data.quoteResponse.result || [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error(
        `Yahoo fetch timeout (${FETCH_TIMEOUT_MS}ms) for batch: ${symbols.slice(0, 3).join(", ")}...`
      );
    } else {
      console.error(`Yahoo fetch error for batch: ${symbols.slice(0, 3).join(", ")}...`, error);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ── Main Handler ────────────────────────────────────────────────────────────

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

    // ── Step 1: Collect all unique tickers from watchlist + assets ─────────

    const { data: watchlistTickers, error: wlError } = await supabase
      .from("watchlist")
      .select("ticker, category");

    if (wlError) {
      throw new Error(`Failed to fetch watchlist tickers: ${wlError.message}`);
    }

    const { data: assetTickers, error: asError } = await supabase
      .from("assets")
      .select("ticker, category")
      .gt("quantity", 0);

    if (asError) {
      throw new Error(`Failed to fetch asset tickers: ${asError.message}`);
    }

    // ── Step 2: Deduplicate by ticker ─────────────────────────────────────

    const tickerMap = new Map<string, string>(); // ticker → category

    for (const row of (watchlistTickers as TickerRow[]) || []) {
      if (!tickerMap.has(row.ticker)) {
        tickerMap.set(row.ticker, row.category);
      }
    }

    for (const row of (assetTickers as TickerRow[]) || []) {
      if (!tickerMap.has(row.ticker)) {
        tickerMap.set(row.ticker, row.category);
      }
    }

    if (tickerMap.size === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No tickers to sync",
          tickersProcessed: 0,
          updated: 0,
          failed: 0,
          fetchedAt: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`Found ${tickerMap.size} unique tickers to sync`);

    // ── Step 3: Map tickers to Yahoo symbols ──────────────────────────────

    // Build a mapping: yahooSymbol → originalTicker
    const symbolToTicker = new Map<string, string>();
    const skipped: string[] = [];

    for (const [ticker, category] of tickerMap) {
      const yahooSymbol = toYahooSymbol(ticker, category);
      if (yahooSymbol) {
        symbolToTicker.set(yahooSymbol, ticker);
      } else {
        skipped.push(ticker);
      }
    }

    if (skipped.length > 0) {
      console.log(`Skipped ${skipped.length} cash tickers: ${skipped.join(", ")}`);
    }

    const allSymbols = Array.from(symbolToTicker.keys());
    console.log(`Mapped to ${allSymbols.length} Yahoo symbols`);

    // ── Step 4: Batch fetch from Yahoo Finance ────────────────────────────

    const batches = chunk(allSymbols, BATCH_SIZE);
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      console.log(
        `Fetching batch ${i + 1}/${batches.length} (${batch.length} symbols)`
      );

      const results = await fetchYahooBatch(batch);

      // Build a set of symbols that returned data
      const returnedSymbols = new Set(results.map((r) => r.symbol));

      // ── Step 5: Upsert each successful quote ─────────────────────────

      for (const quote of results) {
        const originalTicker = symbolToTicker.get(quote.symbol);
        if (!originalTicker) {
          console.warn(`No ticker mapping found for Yahoo symbol: ${quote.symbol}`);
          failed++;
          continue;
        }

        if (
          quote.regularMarketPrice === undefined ||
          quote.regularMarketPrice === null
        ) {
          console.warn(`No price for ${quote.symbol} (ticker: ${originalTicker})`);
          failed++;
          continue;
        }

        const { error: upsertError } = await supabase
          .from("ticker_price_cache")
          .upsert(
            {
              ticker: originalTicker,
              price: quote.regularMarketPrice,
              change_percent: quote.regularMarketChangePercent ?? null,
              volume: quote.regularMarketVolume ?? null,
              currency: quote.currency || "USD",
              source: "yahoo",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "ticker" }
          );

        if (upsertError) {
          console.error(
            `Upsert failed for ${originalTicker}: ${upsertError.message}`
          );
          failed++;
        } else {
          updated++;
        }
      }

      // Count symbols in this batch that got no result
      for (const symbol of batch) {
        if (!returnedSymbols.has(symbol)) {
          const ticker = symbolToTicker.get(symbol);
          console.warn(`No Yahoo result for ${symbol} (ticker: ${ticker})`);
          failed++;
        }
      }

      // Delay between batches (skip delay after last batch)
      if (i < batches.length - 1) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    // ── Step 6: Return summary ────────────────────────────────────────────

    const summary = {
      success: true,
      tickersProcessed: tickerMap.size,
      symbolsMapped: allSymbols.length,
      updated,
      failed,
      skippedCash: skipped.length,
      batches: batches.length,
      fetchedAt: new Date().toISOString(),
    };

    console.log("Sync complete:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Watchlist price sync error:", error);
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
