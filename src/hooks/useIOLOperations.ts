"use client";

import { useQuery } from "@tanstack/react-query";
import type { IOLOperation } from "@/services/iol";

export type OperationStatus = "todas" | "pendientes" | "terminadas" | "canceladas";

interface OperationsResponse {
  operations: IOLOperation[];
  total: number;
  status: OperationStatus;
  error?: string;
}

interface UseIOLOperationsOptions {
  status?: OperationStatus;
  from?: Date;
  to?: Date;
  enabled?: boolean;
}

async function fetchOperations(
  status: OperationStatus,
  from?: Date,
  to?: Date
): Promise<OperationsResponse> {
  const params = new URLSearchParams({ status });

  if (from) {
    params.set("from", from.toISOString().split("T")[0]);
  }
  if (to) {
    params.set("to", to.toISOString().split("T")[0]);
  }

  const res = await fetch(`/api/iol/operations?${params}`);

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to fetch operations");
  }

  return res.json();
}

/**
 * Hook to fetch IOL operations with filters
 */
export function useIOLOperations(options: UseIOLOperationsOptions = {}) {
  const { status = "todas", from, to, enabled = true } = options;

  return useQuery({
    queryKey: [
      "iol-operations",
      status,
      from?.toISOString(),
      to?.toISOString(),
    ],
    queryFn: () => fetchOperations(status, from, to),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Helper to format operation type for display
 */
export function formatOperationType(tipo: string): {
  label: string;
  color: string;
} {
  const t = tipo.toLowerCase();
  if (t.includes("compra")) {
    return { label: "Compra", color: "text-emerald-400" };
  }
  if (t.includes("venta")) {
    return { label: "Venta", color: "text-red-400" };
  }
  return { label: tipo, color: "text-zinc-400" };
}

/**
 * Helper to format operation status for display
 */
export function formatOperationStatus(estado: string): {
  label: string;
  color: string;
  bg: string;
} {
  const e = estado.toLowerCase();
  if (e.includes("terminada") || e.includes("ejecutada")) {
    return {
      label: "Completada",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    };
  }
  if (e.includes("pendiente") || e.includes("iniciada")) {
    return {
      label: "Pendiente",
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    };
  }
  if (e.includes("cancelada")) {
    return {
      label: "Cancelada",
      color: "text-red-400",
      bg: "bg-red-400/10",
    };
  }
  return {
    label: estado,
    color: "text-zinc-400",
    bg: "bg-zinc-400/10",
  };
}
