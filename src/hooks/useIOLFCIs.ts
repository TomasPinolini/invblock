"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { IOLFCIFund, IOLFCIDetails, IOLFCIType } from "@/services/iol";

// --- List all FCIs ---

interface FCIListResponse {
  funds: IOLFCIFund[];
  expired?: boolean;
  error?: string;
}

async function fetchFCIs(): Promise<FCIListResponse> {
  const res = await fetch("/api/iol/fci");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch funds");
  return data;
}

export function useIOLFCIs(options?: {
  type?: string;
  manager?: string;
  search?: string;
}) {
  const query = useQuery({
    queryKey: ["iol-fcis"],
    queryFn: fetchFCIs,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Client-side filtering to avoid extra API calls
  const filtered = query.data?.funds?.filter((fund) => {
    if (options?.type && fund.tipoFondo !== options.type) return false;
    if (options?.manager && fund.administradora !== options.manager) return false;
    if (options?.search) {
      const s = options.search.toLowerCase();
      return (
        fund.simbolo.toLowerCase().includes(s) ||
        fund.descripcion.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Derive unique managers from the fund list (IOL /Administradoras endpoint is 403)
  const managers = useMemo(() => {
    const allFunds = query.data?.funds || [];
    const unique = [...new Set(allFunds.map((f) => f.administradora).filter(Boolean))];
    return unique.sort();
  }, [query.data?.funds]);

  return {
    ...query,
    funds: filtered || [],
    allFunds: query.data?.funds || [],
    managers,
    expired: query.data?.expired,
  };
}

// --- FCI Details ---

interface FCIDetailsResponse {
  fund: IOLFCIDetails;
  expired?: boolean;
  error?: string;
}

async function fetchFCIDetails(symbol: string): Promise<FCIDetailsResponse> {
  const res = await fetch(`/api/iol/fci/${encodeURIComponent(symbol)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch fund details");
  return data;
}

export function useIOLFCIDetails(symbol: string) {
  return useQuery({
    queryKey: ["iol-fci-details", symbol],
    queryFn: () => fetchFCIDetails(symbol),
    staleTime: 5 * 60 * 1000,
    enabled: !!symbol,
  });
}

// --- FCI Types ---

interface FCITypesResponse {
  types: IOLFCIType[];
  expired?: boolean;
  error?: string;
}

async function fetchFCITypes(): Promise<FCITypesResponse> {
  const res = await fetch("/api/iol/fci/types");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch fund types");
  return data;
}

export function useIOLFCITypes() {
  return useQuery({
    queryKey: ["iol-fci-types"],
    queryFn: fetchFCITypes,
    staleTime: 30 * 60 * 1000,
  });
}

