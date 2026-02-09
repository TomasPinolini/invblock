"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface PriceAlert {
  id: string;
  user_id: string;
  ticker: string;
  condition: "above" | "below";
  target_price: number;
  current_price: number | null;
  is_active: boolean;
  triggered_at: string | null;
  created_at: string;
}

interface AlertsResponse {
  alerts: PriceAlert[];
}

interface CreateAlertParams {
  ticker: string;
  condition: "above" | "below";
  targetPrice: number;
}

// Fetch all alerts for the current user
export function usePriceAlerts() {
  return useQuery<AlertsResponse>({
    queryKey: ["price-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
  });
}

// Create a new alert
export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateAlertParams) => {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create alert");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
    },
  });
}

// Update an alert
interface UpdateAlertParams {
  id: string;
  condition?: "above" | "below";
  targetPrice?: number;
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateAlertParams) => {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update alert");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
    },
  });
}

// Delete an alert
export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`/api/alerts?id=${alertId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete alert");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
    },
  });
}
