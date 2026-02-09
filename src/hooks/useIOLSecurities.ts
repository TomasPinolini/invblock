"use client";

import { useQuery } from "@tanstack/react-query";
import type { IOLSecurityWithQuote, IOLInstrumentType } from "@/services/iol";

interface SecuritiesResponse {
  securities: IOLSecurityWithQuote[];
  count: number;
  country: "argentina" | "estados_Unidos";
  instrumentType: string;
  panel: string | null;
  error?: string;
}

interface UseIOLSecuritiesOptions {
  country?: "argentina" | "estados_Unidos";
  instrumentType?: IOLInstrumentType;
  panel?: string;
  search?: string;
  enabled?: boolean;
}

async function fetchSecurities(
  options: UseIOLSecuritiesOptions
): Promise<SecuritiesResponse> {
  const params = new URLSearchParams();

  if (options.country) params.set("country", options.country);
  if (options.instrumentType) params.set("type", options.instrumentType);
  if (options.panel) params.set("panel", options.panel);
  if (options.search) params.set("search", options.search);

  const res = await fetch(`/api/iol/securities?${params}`);

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to fetch securities");
  }

  return res.json();
}

/**
 * Hook to fetch securities/instruments list from IOL
 */
export function useIOLSecurities(options: UseIOLSecuritiesOptions = {}) {
  const { enabled = true, ...queryOptions } = options;

  return useQuery({
    queryKey: [
      "iol-securities",
      queryOptions.country,
      queryOptions.instrumentType,
      queryOptions.panel,
      queryOptions.search,
    ],
    queryFn: () => fetchSecurities(queryOptions),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Instrument type labels for display
 */
export const INSTRUMENT_TYPE_LABELS: Record<IOLInstrumentType | "all", string> = {
  all: "Todos",
  cedears: "CEDEARs",
  acciones: "Acciones",
  aDRs: "ADRs",
  titulosPublicos: "Bonos",
  obligacionesNegociables: "ONs",
  letras: "Letras",
  cauciones: "Cauciones",
  opciones: "Opciones",
  futuros: "Futuros",
  cHPD: "Cheques",
};

/**
 * Common instrument types for the main filter
 */
export const MAIN_INSTRUMENT_TYPES: (IOLInstrumentType | "all")[] = [
  "all",
  "cedears",
  "acciones",
  "titulosPublicos",
  "obligacionesNegociables",
];

/**
 * BCBA Panels
 */
export const BCBA_PANELS = [
  { value: "lideres", label: "Líderes" },
  { value: "general", label: "General" },
  { value: "cedears", label: "CEDEARs" },
] as const;
