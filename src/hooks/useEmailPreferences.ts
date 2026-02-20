"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";

export interface EmailPreferences {
  id: string;
  userId: string;
  dailyReport: boolean;
  weeklyDigest: boolean;
  priceAlerts: boolean;
  securityAlerts: boolean;
  createdAt: string;
  updatedAt: string;
}

async function fetchEmailPreferences(): Promise<EmailPreferences> {
  const res = await fetch("/api/email-preferences");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch preferences");
  return data;
}

export function useEmailPreferences() {
  return useQuery<EmailPreferences>({
    queryKey: ["email-preferences"],
    queryFn: fetchEmailPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

interface UpdateParams {
  dailyReport?: boolean;
  weeklyDigest?: boolean;
  priceAlerts?: boolean;
  securityAlerts?: boolean;
}

export function useUpdateEmailPreferences() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: async (params: UpdateParams) => {
      const res = await fetch("/api/email-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update preferences");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-preferences"] });
      addToast("Preferencias de email actualizadas", "success");
    },
    onError: (error) => {
      addToast(error.message, "error");
    },
  });
}
