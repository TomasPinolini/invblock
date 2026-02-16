"use client";

import { useQuery } from "@tanstack/react-query";

export interface SnapshotRow {
  id: string;
  snapshotDate: string;
  totalValueUsd: string;
  totalCostUsd: string;
  totalPnlUsd: string;
  totalPnlPercent: string | null;
  assetCount: number;
  byCategory: Record<string, { value: number; cost: number; count: number }> | null;
}

interface SnapshotsResponse {
  snapshots: SnapshotRow[];
}

async function fetchSnapshots(days: number): Promise<SnapshotsResponse> {
  const res = await fetch(`/api/snapshots?days=${days}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch snapshots");
  return data;
}

export function usePortfolioSnapshots(days = 90) {
  return useQuery({
    queryKey: ["portfolio-snapshots", days],
    queryFn: () => fetchSnapshots(days),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
