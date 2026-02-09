"use client";

import { useQuery } from "@tanstack/react-query";

export interface IOLBalances {
  ars: {
    disponible: number; // Available cash
    comprometido: number; // Committed in orders
    total: number; // Total balance
  };
  usd: {
    disponible: number;
    comprometido: number;
    total: number;
  };
  totalEnPesos: number;
}

interface IOLBalanceResponse {
  balances: IOLBalances;
  raw?: unknown;
  error?: string;
}

async function fetchIOLBalance(): Promise<IOLBalanceResponse> {
  const res = await fetch("/api/iol/balance");
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch balance");
  }
  return data;
}

export function useIOLBalance() {
  return useQuery({
    queryKey: ["iol-balance"],
    queryFn: fetchIOLBalance,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
