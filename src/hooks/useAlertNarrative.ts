"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AlertNarrative } from "./usePriceAlerts";

interface NarrativeResponse extends AlertNarrative {
  cached: boolean;
}

async function generateNarrative(alertId: string): Promise<NarrativeResponse> {
  const res = await fetch("/api/insights/alert-narrative", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alertId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to generate narrative");
  return data;
}

export function useAlertNarrative() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateNarrative,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
    },
  });
}
