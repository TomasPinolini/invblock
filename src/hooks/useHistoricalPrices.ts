import { useQuery } from "@tanstack/react-query";
import type { TimePeriod } from "@/services/yahoo/client";

interface HistoricalPricesResponse {
  period: TimePeriod;
  prices: Record<string, number>;
  fetchedAt: string;
}

interface HistoricalPricesParams {
  tickers: string[];
  categories: string[];
  period: TimePeriod;
  enabled?: boolean;
}

export function useHistoricalPrices({
  tickers,
  categories,
  period,
  enabled = true,
}: HistoricalPricesParams) {
  return useQuery<HistoricalPricesResponse>({
    queryKey: ["historical-prices", tickers.join(","), period],
    queryFn: async () => {
      if (tickers.length === 0 || period === "ALL") {
        return { period, prices: {}, fetchedAt: new Date().toISOString() };
      }

      const params = new URLSearchParams({
        tickers: tickers.join(","),
        categories: categories.join(","),
        period,
      });

      const response = await fetch(`/api/prices/historical?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch historical prices");
      }

      return response.json();
    },
    enabled: enabled && tickers.length > 0 && period !== "ALL",
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
  });
}

// Hook for fetching detailed history for a single ticker (for charts)
interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TickerHistoryResponse {
  ticker: string;
  period: TimePeriod;
  history: HistoricalDataPoint[];
  fetchedAt: string;
}

export function useTickerHistory(
  ticker: string | null,
  category: string | null,
  period: TimePeriod,
  enabled: boolean = true
) {
  return useQuery<TickerHistoryResponse>({
    queryKey: ["ticker-history", ticker, period],
    queryFn: async () => {
      const response = await fetch("/api/prices/historical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, category, period }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch ticker history");
      }

      return response.json();
    },
    enabled: enabled && !!ticker && !!category,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
