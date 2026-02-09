"use client";

import { useQuery } from "@tanstack/react-query";
import type { IOLNotification } from "@/services/iol/types";

interface IOLNotificationsResponse {
  notifications: IOLNotification[];
  error?: string;
}

async function fetchIOLNotifications(): Promise<IOLNotificationsResponse> {
  const res = await fetch("/api/iol/notifications");
  // Don't throw on error - notifications are non-critical
  // Just return empty array if something goes wrong
  if (!res.ok) {
    return { notifications: [] };
  }
  return res.json();
}

export function useIOLNotifications() {
  return useQuery({
    queryKey: ["iol-notifications"],
    queryFn: fetchIOLNotifications,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
}
