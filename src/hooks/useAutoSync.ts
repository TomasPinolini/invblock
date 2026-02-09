"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ConnectionStatus {
  connected: boolean;
  updatedAt: string | null;
}

interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  total: number;
}

/**
 * Auto-sync hook that runs once on mount to sync connected brokers.
 * Checks IOL and Binance connection status, then triggers sync for each.
 */
export function useAutoSync() {
  const queryClient = useQueryClient();
  const hasSynced = useRef(false);

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
      const syncPromises: Promise<void>[] = [];

      // Sync IOL if connected (assets + transactions)
      if (iolStatus?.connected) {
        console.log("[AutoSync] IOL connected, syncing...");
        syncPromises.push(
          fetch("/api/iol/sync", { method: "POST" })
            .then((res) => res.json())
            .then(async (data: SyncResult) => {
              if (data.success) {
                console.log(
                  `[AutoSync] IOL assets synced: ${data.created} new, ${data.updated} updated`
                );
                // Also sync transactions
                const txnRes = await fetch("/api/iol/transactions", {
                  method: "POST",
                });
                const txnData = await txnRes.json();
                if (txnData.success) {
                  console.log(
                    `[AutoSync] IOL transactions synced: ${txnData.created} new, ${txnData.skipped} skipped`
                  );
                }
              }
            })
            .catch((err) => console.error("[AutoSync] IOL sync failed:", err))
        );
      }

      // Sync Binance if connected
      if (binanceStatus?.connected) {
        console.log("[AutoSync] Binance connected, syncing...");
        syncPromises.push(
          fetch("/api/binance/sync", { method: "POST" })
            .then((res) => res.json())
            .then((data: SyncResult) => {
              if (data.success) {
                console.log(
                  `[AutoSync] Binance synced: ${data.created} new, ${data.updated} updated`
                );
              }
            })
            .catch((err) =>
              console.error("[AutoSync] Binance sync failed:", err)
            )
        );
      }

      if (syncPromises.length > 0) {
        await Promise.allSettled(syncPromises);
        // Invalidate queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ["assets"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
      }
    };

    runSync();
  }, [iolStatus, binanceStatus, queryClient]);

  return {
    iolConnected: iolStatus?.connected ?? false,
    binanceConnected: binanceStatus?.connected ?? false,
  };
}
