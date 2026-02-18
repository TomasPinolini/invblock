"use client";

import { useQuery } from "@tanstack/react-query";

interface PPIStatusResponse {
  connected: boolean;
  updatedAt: string | null;
}

async function fetchPPIStatus(): Promise<PPIStatusResponse> {
  const res = await fetch("/api/ppi/status");
  return res.json();
}

export function usePPIStatus() {
  return useQuery({
    queryKey: ["ppi-status"],
    queryFn: fetchPPIStatus,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
