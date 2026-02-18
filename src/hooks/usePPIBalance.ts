"use client";

import { useQuery } from "@tanstack/react-query";

export interface PPIBalances {
  ars: {
    disponible: number;
    comprometido: number;
    total: number;
  };
  usd: {
    disponible: number;
    comprometido: number;
    total: number;
  };
}

interface PPIBalanceResponse {
  balances: PPIBalances;
  error?: string;
}

async function fetchPPIBalance(): Promise<PPIBalanceResponse> {
  const res = await fetch("/api/ppi/balance");
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch balance");
  }
  return data;
}

export function usePPIBalance() {
  return useQuery({
    queryKey: ["ppi-balance"],
    queryFn: fetchPPIBalance,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
