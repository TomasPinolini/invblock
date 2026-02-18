"use client";

import { useQuery } from "@tanstack/react-query";

interface PPIQuoteItem {
  Ticker: string;
  Last: number;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  Change: number;
  Date: string;
  Bid: number;
  Ask: number;
}

interface PPIQuotesResponse {
  quotes: Record<string, PPIQuoteItem | null>;
}

async function fetchPPIQuotes(
  tickers: Array<{ ticker: string; type: string }>
): Promise<PPIQuotesResponse> {
  const res = await fetch("/api/ppi/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch quotes");
  }
  return data;
}

export function usePPIQuotes(
  tickers: Array<{ ticker: string; type: string }>,
  enabled: boolean = true
) {
  const tickerKey = tickers.map((t) => `${t.ticker}:${t.type}`).join(",");

  return useQuery({
    queryKey: ["ppi-quotes", tickerKey],
    queryFn: () => fetchPPIQuotes(tickers),
    enabled: enabled && tickers.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes
  });
}
