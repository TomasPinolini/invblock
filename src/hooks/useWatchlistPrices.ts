"use client";

import { useQuery } from "@tanstack/react-query";
import type { AssetCategory } from "@/lib/constants";

export interface WatchlistSecurity {
  simbolo: string;
  descripcion: string;
  ultimoPrecio: number;
  variacionPorcentual: number;
  cierreAnterior?: number;
  // Extra metadata from watchlist
  _watchlistId: string;
  _category: AssetCategory;
  _notes: string | null;
}

interface WatchlistPricesResponse {
  securities: WatchlistSecurity[];
  count: number;
}

async function fetchWatchlistPrices(): Promise<WatchlistPricesResponse> {
  const res = await fetch("/api/watchlist/prices");
  if (!res.ok) throw new Error("Failed to fetch watchlist prices");
  return res.json();
}

export function useWatchlistPrices(enabled = true) {
  return useQuery({
    queryKey: ["watchlist-prices"],
    queryFn: fetchWatchlistPrices,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
