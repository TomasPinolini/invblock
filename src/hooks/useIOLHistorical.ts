"use client";

import { useQuery } from "@tanstack/react-query";

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface IOLHistoricalResponse {
  symbol: string;
  market: string;
  from: string;
  to: string;
  adjusted: boolean;
  history: HistoricalDataPoint[];
  source: "iol";
  error?: string;
}

interface UseIOLHistoricalOptions {
  symbol: string;
  market?: string;
  category?: string;
  from?: string;
  to?: string;
  adjusted?: boolean;
  enabled?: boolean;
}

async function fetchIOLHistorical(
  options: UseIOLHistoricalOptions
): Promise<IOLHistoricalResponse> {
  const params = new URLSearchParams();
  params.set("symbol", options.symbol);

  if (options.market) params.set("market", options.market);
  if (options.category) params.set("category", options.category);
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  if (options.adjusted !== undefined) {
    params.set("adjusted", String(options.adjusted));
  }

  const res = await fetch(`/api/iol/historical?${params}`);

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to fetch IOL historical data");
  }

  return res.json();
}

/**
 * Hook to fetch historical prices from IOL
 */
export function useIOLHistorical(options: UseIOLHistoricalOptions) {
  const { symbol, enabled = true, ...rest } = options;

  return useQuery({
    queryKey: ["iol-historical", symbol, rest.from, rest.to, rest.adjusted],
    queryFn: () => fetchIOLHistorical({ symbol, ...rest }),
    enabled: enabled && !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

/**
 * Helper to calculate date range for a time period
 */
export function getDateRangeForPeriod(period: string): { from: string; to: string } {
  const to = new Date();
  const from = new Date();

  switch (period) {
    case "1D":
      from.setDate(from.getDate() - 1);
      break;
    case "1W":
      from.setDate(from.getDate() - 7);
      break;
    case "1M":
      from.setMonth(from.getMonth() - 1);
      break;
    case "3M":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6M":
      from.setMonth(from.getMonth() - 6);
      break;
    case "1Y":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "5Y":
      from.setFullYear(from.getFullYear() - 5);
      break;
    case "ALL":
      from.setFullYear(from.getFullYear() - 20); // Max 20 years
      break;
    default:
      from.setFullYear(from.getFullYear() - 1);
  }

  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}
