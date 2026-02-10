"use client";

import { useQuery } from "@tanstack/react-query";
import type { IOLMepPair } from "@/services/iol";

interface MepEstimate {
  amount: number;
  direction: "buy" | "sell";
  arsRequired?: number;
  arsResult?: number;
  fee: number;
  feeAmount: number;
  rate: number;
}

interface MepResponse {
  pairs: IOLMepPair[];
  averageRate: number;
  timestamp: string;
  estimate: MepEstimate | null;
  expired?: boolean;
  error?: string;
}

async function fetchMepRates(
  amount?: number,
  direction?: "buy" | "sell"
): Promise<MepResponse> {
  const params = new URLSearchParams();
  if (amount) params.set("amount", String(amount));
  if (direction) params.set("direction", direction);

  const qs = params.toString();
  const url = `/api/iol/mep${qs ? `?${qs}` : ""}`;

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch MEP rates");
  return data;
}

export function useIOLMep(options?: {
  amount?: number;
  direction?: "buy" | "sell";
}) {
  return useQuery({
    queryKey: ["iol-mep", options?.amount, options?.direction],
    queryFn: () => fetchMepRates(options?.amount, options?.direction),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
