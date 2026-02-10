"use client";

import { useQuery } from "@tanstack/react-query";

interface ExchangeRateResponse {
  rate: number | null;
  updatedAt: string | null;
  error?: string;
}

const FALLBACK_RATE = 1250; // Last known approximate rate

export function useExchangeRate() {
  const query = useQuery<ExchangeRateResponse>({
    queryKey: ["exchange-rate"],
    queryFn: async () => {
      const res = await fetch("/api/exchange-rate");
      if (!res.ok) throw new Error("Failed to fetch exchange rate");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    retry: 2,
  });

  return {
    /** USD/ARS sell rate — always a number (fallback if API fails) */
    rate: query.data?.rate ?? FALLBACK_RATE,
    /** Whether using the real rate (vs fallback) */
    isLive: query.data?.rate != null,
    /** Last update timestamp from dolarapi */
    updatedAt: query.data?.updatedAt ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
