"use client";

import { useQuery } from "@tanstack/react-query";

export interface PPIAsset {
  id: string;
  ticker: string;
  name: string;
  category: "stock" | "cedear" | "crypto" | "cash";
  currency: "USD" | "ARS";
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

interface PPIPortfolioResponse {
  connected: boolean;
  expired?: boolean;
  assets: PPIAsset[];
  error?: string;
}

async function fetchPPIPortfolio(): Promise<PPIPortfolioResponse> {
  const res = await fetch("/api/ppi/portfolio");
  const data = await res.json();

  if (!res.ok && !data.expired) {
    throw new Error(data.error || "Failed to fetch portfolio");
  }
  return data;
}

export function usePPIPortfolio() {
  return useQuery({
    queryKey: ["ppi-portfolio"],
    queryFn: fetchPPIPortfolio,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });
}
