"use client";

import { useQuery } from "@tanstack/react-query";
import type { IOLNotification } from "@/services/iol/types";

interface IOLNotificationsResponse {
  notifications: IOLNotification[];
  error?: string;
}

async function fetchIOLNotifications(): Promise<IOLNotificationsResponse> {
  const res = await fetch("/api/iol/notifications");
  if (!res.ok) {
    throw new Error("Failed to fetch notifications");
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
