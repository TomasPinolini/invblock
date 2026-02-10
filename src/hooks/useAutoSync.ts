"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/stores/useAppStore";

interface ConnectionStatus {
  connected: boolean;
  updatedAt: string | null;
}

/**
 * Auto-sync hook that runs once on mount to sync connected brokers.
 * Checks IOL and Binance connection status, then triggers sync for each.
 */
export function useAutoSync() {
  const queryClient = useQueryClient();
  const hasSynced = useRef(false);
  const { startSync, completeSync, failSync } = useAppStore();

  // Check IOL connection status
  const { data: iolStatus } = useQuery<ConnectionStatus>({
    queryKey: ["iol-status"],
    queryFn: async () => {
      const res = await fetch("/api/iol/status");
      return res.json();
    },
    staleTime: Infinity, // Don't refetch automatically
  });

  // Check Binance connection status
  const { data: binanceStatus } = useQuery<ConnectionStatus>({
    queryKey: ["binance-status"],
    queryFn: async () => {
      const res = await fetch("/api/binance/status");
      return res.json();
    },
    staleTime: Infinity,
  });

  // Run sync once when we have status info
  useEffect(() => {
    if (hasSynced.current) return;
    if (iolStatus === undefined || binanceStatus === undefined) return;

    const runSync = async () => {
      hasSynced.current = true;
      const errors: string[] = [];

      const hasIOL = iolStatus?.connected;
      const hasBinance = binanceStatus?.connected;

      if (!hasIOL && !hasBinance) return;

      startSync(hasIOL && hasBinance ? "all" : hasIOL ? "iol" : "binance");

      // Sync IOL if connected (assets + transactions)
      if (hasIOL) {
        try {
          const res = await fetch("/api/iol/sync", { method: "POST" });
          const data = await res.json();
          if (!res.ok) {
            errors.push(`IOL sync: ${data.error || "failed"}`);
          } else if (data?.success) {
            await fetch("/api/iol/transactions", { method: "POST" });
          }
        } catch (err) {
          console.error("IOL auto-sync failed:", err);
          errors.push("IOL sync: network error");
        }
      }

      // Sync Binance if connected
      if (hasBinance) {
        try {
          const res = await fetch("/api/binance/sync", { method: "POST" });
          if (!res.ok) {
            const data = await res.json();
            errors.push(`Binance sync: ${data.error || "failed"}`);
          }
        } catch (err) {
          console.error("Binance auto-sync failed:", err);
          errors.push("Binance sync: network error");
        }
      }

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });

      if (errors.length > 0) {
        failSync(errors.join("; "));
      } else {
        completeSync();
      }
    };

    runSync();
  }, [iolStatus, binanceStatus, queryClient, startSync, completeSync, failSync]);

  return {
    iolConnected: iolStatus?.connected ?? false,
    binanceConnected: binanceStatus?.connected ?? false,
  };
}
