"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { IOLSettlement, IOLOrderType } from "@/services/iol";

interface TradeRequest {
  action: "buy" | "sell";
  mercado: string;
  simbolo: string;
  cantidad: number;
  precio: number;
  plazo?: IOLSettlement;
  validez?: string;
  tipoOrden?: IOLOrderType;
}

interface TradeResponse {
  ok: boolean;
  numeroOperacion?: number;
  mensaje?: string;
  error?: string;
  order?: {
    action: "buy" | "sell";
    simbolo: string;
    cantidad: number;
    precio: number;
    plazo: string;
  };
}

interface CancelResponse {
  ok: boolean;
  mensaje?: string;
  error?: string;
}

async function executeTrade(request: TradeRequest): Promise<TradeResponse> {
  const res = await fetch("/api/iol/trade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Trade failed");
  }

  return data;
}

async function cancelOrder(operationNumber: number): Promise<CancelResponse> {
  const res = await fetch(
    `/api/iol/trade?operationNumber=${operationNumber}`,
    { method: "DELETE" }
  );

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Cancel failed");
  }

  return data;
}

/**
 * Hook for executing trades (buy/sell)
 */
export function useIOLTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: executeTrade,
    onSuccess: () => {
      // Invalidate portfolio and operations queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["iol-operations"] });
      queryClient.invalidateQueries({ queryKey: ["iol-quotes"] });
    },
  });
}

/**
 * Hook for canceling pending orders
 */
export function useIOLCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      // Invalidate operations to refresh pending orders
      queryClient.invalidateQueries({ queryKey: ["iol-operations"] });
    },
  });
}

/**
 * Helper to format order details for display
 */
export function formatOrderSummary(order: {
  action: "buy" | "sell";
  simbolo: string;
  cantidad: number;
  precio: number;
  plazo?: string;
}): string {
  const actionLabel = order.action === "buy" ? "Comprar" : "Vender";
  const plazoLabel = order.plazo === "t0" ? "Contado" : order.plazo === "t1" ? "24hs" : "48hs";
  return `${actionLabel} ${order.cantidad} ${order.simbolo} a $${order.precio.toFixed(2)} (${plazoLabel})`;
}

/**
 * Settlement options for display
 */
export const SETTLEMENT_OPTIONS: Array<{ value: IOLSettlement; label: string; description: string }> = [
  { value: "t0", label: "Contado", description: "Liquidación inmediata" },
  { value: "t1", label: "24 horas", description: "Liquidación en 24hs" },
  { value: "t2", label: "48 horas", description: "Liquidación en 48hs (más común)" },
];
