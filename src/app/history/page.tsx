"use client";

import { useState } from "react";
import { RefreshCw, Loader2, History, Clock, CheckCircle, XCircle, Download } from "lucide-react";
import { useIOLOperations, type OperationStatus } from "@/hooks/useIOLOperations";
import OperationsTable from "@/components/history/OperationsTable";
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/lib/csv";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const TABS: { value: OperationStatus; label: string; icon: React.ReactNode }[] = [
  { value: "todas", label: "Todas", icon: <History className="h-4 w-4" /> },
  { value: "pendientes", label: "Pendientes", icon: <Clock className="h-4 w-4" /> },
  { value: "terminadas", label: "Completadas", icon: <CheckCircle className="h-4 w-4" /> },
  { value: "canceladas", label: "Canceladas", icon: <XCircle className="h-4 w-4" /> },
];

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<OperationStatus>("todas");

  const { data, isLoading, error, refetch, isFetching } = useIOLOperations({
    status: activeTab,
  });

  const operations = data?.operations || [];

  const handleExportCSV = () => {
    const headers = [
      "Date", "Ticker", "Market", "Type", "Quantity",
      "Price", "Total", "Currency", "Status",
    ];
    const rows = operations.map((op) => [
      op.fechaOrden ? new Date(op.fechaOrden).toLocaleDateString() : "",
      op.simbolo,
      op.mercado,
      op.tipo,
      String(op.cantidadOperada ?? op.cantidad),
      String(op.precioOperado ?? op.precio),
      String(op.montoOperado ?? op.montoTotal),
      op.mercado === "nYSE" ? "USD" : "ARS",
      op.estado,
    ]);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`operations-${date}.csv`, headers, rows);
  };

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Historial de Operaciones</h1>
            <p className="text-sm text-zinc-500">
              Tus operaciones en IOL
            </p>
          </div>

          <div className="flex items-center gap-2">
            {operations.length > 0 && (
              <button
                onClick={handleExportCSV}
                aria-label="Export operations as CSV"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg
                           bg-zinc-800 hover:bg-zinc-700
                           text-sm font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh operations history"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg
                         bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50
                         text-sm font-medium transition-colors"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-lg overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab.value
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.value === activeTab && data && (
                <span className="ml-1 text-xs text-zinc-500">
                  ({operations.length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <OperationsTable
          operations={operations}
          isLoading={isLoading}
          error={error}
        />

        {/* Footer */}
        <div className="text-xs text-zinc-600 text-center">
          Datos de InvertirOnline · Última actualización: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}
