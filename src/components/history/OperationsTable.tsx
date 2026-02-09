"use client";

import React from "react";
import { Loader2, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { IOLOperation } from "@/services/iol";
import { formatOperationType, formatOperationStatus } from "@/hooks/useIOLOperations";
import { formatCurrency, cn } from "@/lib/utils";

interface OperationsTableProps {
  operations: IOLOperation[];
  isLoading: boolean;
  error?: Error | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OperationsTable({
  operations,
  isLoading,
  error,
}: OperationsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        <span className="ml-2 text-sm text-zinc-500">Cargando operaciones...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-400">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span className="text-sm">{error.message}</span>
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p>No hay operaciones para mostrar</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-950/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800/60">
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Fecha
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Ticker
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Tipo
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden sm:table-cell">
              Cantidad
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden sm:table-cell">
              Precio
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Total
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {operations.map((op) => {
            const type = formatOperationType(op.tipo);
            const status = formatOperationStatus(op.estado);
            const isBuy = op.tipo.toLowerCase().includes("compra");
            const executedQty = op.cantidadOperada ?? op.cantidad;
            const executedPrice = op.precioOperado ?? op.precio;
            const executedTotal = op.montoOperado ?? op.montoTotal;

            // Determine currency from market
            const currency = op.mercado?.toLowerCase().includes("estados")
              ? "USD"
              : "ARS";

            return (
              <tr
                key={op.numero}
                className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
              >
                <td className="px-3 py-2">
                  <span className="text-zinc-400 text-xs">
                    {formatDate(op.fechaOrden)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono font-semibold text-zinc-100">
                    {op.simbolo}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={cn("inline-flex items-center gap-1 font-medium", type.color)}>
                    {isBuy ? (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    )}
                    {type.label}
                  </span>
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  <span className="font-mono text-zinc-300">
                    {executedQty.toLocaleString()}
                  </span>
                  {op.cantidadOperada !== undefined &&
                    op.cantidadOperada !== op.cantidad && (
                      <span className="text-zinc-600 text-xs ml-1">
                        / {op.cantidad}
                      </span>
                    )}
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  <span className="font-mono text-zinc-300">
                    {formatCurrency(executedPrice, currency)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={cn("font-mono font-semibold", type.color)}>
                    {formatCurrency(executedTotal, currency)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      status.color,
                      status.bg
                    )}
                  >
                    {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
