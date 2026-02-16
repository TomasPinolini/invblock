"use client";

import { useQuery } from "@tanstack/react-query";
import type { MacroData } from "@/services/macro/client";

async function fetchMacro(): Promise<MacroData> {
  const res = await fetch("/api/macro");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch macro data");
  return data;
}

export function useMacroData() {
  return useQuery({
    queryKey: ["macro-data"],
    queryFn: fetchMacro,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
