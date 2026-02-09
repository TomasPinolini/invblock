"use client";

import { useState } from "react";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  Filter,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import {
  useIOLSecurities,
  INSTRUMENT_TYPE_LABELS,
  MAIN_INSTRUMENT_TYPES,
} from "@/hooks/useIOLSecurities";
import type { IOLInstrumentType, IOLSecurityWithQuote } from "@/services/iol";
import { cn } from "@/lib/utils";

export default function ExplorePage() {
  const [instrumentType, setInstrumentType] = useState<IOLInstrumentType | "all">("cedears");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    // Simple debounce
    setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useIOLSecurities({
    country: "argentina",
    instrumentType: instrumentType === "all" ? undefined : instrumentType,
    search: debouncedSearch || undefined,
  });

  const securities = data?.securities || [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al portfolio
          </Link>
          <h1 className="text-2xl font-bold text-zinc-100">Explorar Mercado</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Buscar y explorar instrumentos disponibles en IOL
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por símbolo o nombre..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg
                       text-zinc-100 placeholder:text-zinc-600
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg
                     text-zinc-300 font-medium transition-colors
                     disabled:opacity-50 flex items-center gap-2"
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        {/* Instrument Type Tabs */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
          <Filter className="h-4 w-4 text-zinc-500 mr-2 shrink-0" />
          {MAIN_INSTRUMENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setInstrumentType(type)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
                instrumentType === type
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
              )}
            >
              {INSTRUMENT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <div className="text-sm text-zinc-500 mb-4">
          {isLoading ? (
            "Cargando..."
          ) : (
            <>
              {securities.length} instrumento{securities.length !== 1 && "s"} encontrado{securities.length !== 1 && "s"}
              {debouncedSearch && ` para "${debouncedSearch}"`}
            </>
          )}
        </div>

        {/* Securities Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            <span className="ml-3 text-zinc-500">Cargando instrumentos...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="h-10 w-10 text-amber-400 mb-3" />
            <p className="text-amber-400 font-medium">No se pudo cargar la lista</p>
            <p className="text-sm text-zinc-500 mt-1 max-w-md">
              {error instanceof Error && error.message.includes("500")
                ? "El mercado puede estar cerrado. Esta funcionalidad está disponible durante horario de mercado (11:00 - 17:00 ART)."
                : error instanceof Error
                ? error.message
                : "Intente nuevamente más tarde"}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
            >
              Reintentar
            </button>
          </div>
        ) : securities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-10 w-10 text-zinc-600 mb-3" />
            <p className="text-zinc-400">No se encontraron instrumentos</p>
            <p className="text-sm text-zinc-600 mt-1">
              Intente con otro filtro o término de búsqueda
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {securities.map((security) => (
              <SecurityCard key={security.simbolo} security={security} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SecurityCard({ security }: { security: IOLSecurityWithQuote }) {
  const change = security.variacionPorcentual || 0;
  const isPositive = change >= 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-zinc-100 font-mono">{security.simbolo}</h3>
          <p className="text-xs text-zinc-500 line-clamp-1" title={security.descripcion}>
            {security.descripcion}
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-mono font-semibold",
            isPositive ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400"
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {isPositive ? "+" : ""}
          {change.toFixed(2)}%
        </div>
      </div>

      {/* Price */}
      <div className="mb-3">
        <p className="text-2xl font-bold font-mono text-zinc-100">
          ${security.ultimoPrecio?.toLocaleString("es-AR", { minimumFractionDigits: 2 }) || "--"}
        </p>
      </div>

      {/* OHLC */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-zinc-600 uppercase">Apertura</p>
          <p className="font-mono text-zinc-400">
            {security.apertura?.toLocaleString("es-AR") || "--"}
          </p>
        </div>
        <div>
          <p className="text-zinc-600 uppercase">Máximo</p>
          <p className="font-mono text-emerald-400">
            {security.maximo?.toLocaleString("es-AR") || "--"}
          </p>
        </div>
        <div>
          <p className="text-zinc-600 uppercase">Mínimo</p>
          <p className="font-mono text-red-400">
            {security.minimo?.toLocaleString("es-AR") || "--"}
          </p>
        </div>
        <div>
          <p className="text-zinc-600 uppercase">Anterior</p>
          <p className="font-mono text-zinc-400">
            {security.cierreAnterior?.toLocaleString("es-AR") || "--"}
          </p>
        </div>
      </div>

      {/* Volume */}
      {security.volumen && (
        <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between text-xs">
          <span className="text-zinc-600">Volumen</span>
          <span className="font-mono text-zinc-400">
            {security.volumen.toLocaleString("es-AR")} acciones
          </span>
        </div>
      )}
    </div>
  );
}
