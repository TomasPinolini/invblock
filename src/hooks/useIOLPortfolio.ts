"use client";

import { useQuery } from "@tanstack/react-query";

import type { BrokerPortfolioAsset } from "@/types/portfolio";

export type IOLAsset = BrokerPortfolioAsset;

interface IOLPortfolioResponse {
  connected: boolean;
  expired?: boolean; // Token expired, needs re-authentication
  assets: IOLAsset[];
  totals?: {
    pesos: number;
    dolares: number;
  };
  error?: string;
}

async function fetchIOLPortfolio(): Promise<IOLPortfolioResponse> {
  const res = await fetch("/api/iol/portfolio");
  const data = await res.json();

  if (!res.ok && !data.expired) {
    throw new Error(data.error || "Failed to fetch portfolio");
  }
  return data;
}

export function useIOLPortfolio() {
  return useQuery({
    queryKey: ["iol-portfolio"],
    queryFn: fetchIOLPortfolio,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });
}
