"use client";

import { useQuery } from "@tanstack/react-query";
import type { IOLQuote } from "@/services/iol";

interface QuotesResponse {
  quotes: Record<string, IOLQuote | null>;
  error?: string;
}

interface TickerRequest {
  symbol: string;
  market?: string;
  category?: string;
}

async function fetchQuotes(tickers: TickerRequest[]): Promise<QuotesResponse> {
  if (!tickers.length) {
    return { quotes: {} };
  }

  const res = await fetch("/api/iol/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
  });

  if (!res.ok) {
    return { quotes: {} };
  }

  return res.json();
}

/**
 * Hook to fetch live quotes for multiple tickers
 * Uses batch endpoint for efficiency
 */
export function useIOLQuotes(tickers: TickerRequest[], enabled = true) {
  // Create a stable key from ticker symbols
  const tickerKey = tickers.map((t) => t.symbol).sort().join(",");

  return useQuery({
    queryKey: ["iol-quotes", tickerKey],
    queryFn: () => fetchQuotes(tickers),
    enabled: enabled && tickers.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes (matches staleTime)
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch a single quote
 */
export function useIOLQuote(
  symbol: string,
  market?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ["iol-quote", symbol, market],
    queryFn: async () => {
      const params = new URLSearchParams({ symbol });
      if (market) params.set("market", market);

      const res = await fetch(`/api/iol/quote?${params}`);
      if (!res.ok) return null;

      const data = await res.json();
      return data.quote as IOLQuote | null;
    },
    enabled: enabled && !!symbol,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
