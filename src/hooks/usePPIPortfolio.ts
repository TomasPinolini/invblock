"use client";

import { useQuery } from "@tanstack/react-query";

import type { BrokerPortfolioAsset } from "@/types/portfolio";

export type PPIAsset = BrokerPortfolioAsset;

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
