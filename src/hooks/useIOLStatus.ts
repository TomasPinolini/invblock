"use client";

import { useQuery } from "@tanstack/react-query";

interface IOLStatusResponse {
  connected: boolean;
  updatedAt: string | null;
}

async function fetchIOLStatus(): Promise<IOLStatusResponse> {
  const res = await fetch("/api/iol/status");
  return res.json();
}

export function useIOLStatus() {
  return useQuery({
    queryKey: ["iol-status"],
    queryFn: fetchIOLStatus,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
