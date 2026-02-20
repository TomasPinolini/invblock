"use client";

import { useQuery } from "@tanstack/react-query";

import type { BrokerPortfolioAsset } from "@/types/portfolio";

export interface BinanceAsset extends BrokerPortfolioAsset {
  locked: number;
}

interface BinancePortfolioResponse {
  connected: boolean;
  expired?: boolean;
  assets: BinanceAsset[];
  totals?: {
    usd: number;
  };
  error?: string;
}

async function fetchBinancePortfolio(): Promise<BinancePortfolioResponse> {
  const res = await fetch("/api/binance/portfolio");
  const data = await res.json();

  if (!res.ok && !data.expired) {
    throw new Error(data.error || "Failed to fetch Binance portfolio");
  }
  return data;
}

export function useBinancePortfolio() {
  return useQuery({
    queryKey: ["binance-portfolio"],
    queryFn: fetchBinancePortfolio,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });
}
