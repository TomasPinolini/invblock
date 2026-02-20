"use client";

import { useState, useRef } from "react";
import {
  Landmark,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { useIOLFCIs, useIOLFCIDetails, useIOLFCITypes } from "@/hooks/useIOLFCIs";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type { IOLFCIFund } from "@/services/iol";

export default function FundsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const [expandedFund, setExpandedFund] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  const {
    funds,
    managers,
    isLoading,
    error,
    refetch,
    isFetching,
    expired,
  } = useIOLFCIs({
    type: selectedType || undefined,
    manager: selectedManager || undefined,
    search: debouncedSearch || undefined,
  });

  const { data: typesData } = useIOLFCITypes();

  const types = typesData?.types || [];

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedType("");
    setSelectedManager("");
  };

  const hasFilters = !!debouncedSearch || !!selectedType || !!selectedManager;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Landmark className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-100">Fondos Comunes de Inversión</h1>
                <p className="text-sm text-zinc-500">
                  Explorá los FCIs disponibles en IOL
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar por símbolo o nombre..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg
                         text-zinc-100 placeholder:text-zinc-500
                         focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
            </div>

            {/* Type filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg
                       text-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
            >
              <option value="">Todos los tipos</option>
              {types.map((t) => (
                <option key={t.tipo} value={t.tipo}>
                  {t.descripcion || t.tipo}
                </option>
              ))}
            </select>

            {/* Manager filter */}
            <select
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
              className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg
                       text-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 max-w-[200px]"
            >
              <option value="">Todas las administradoras</option>
              {managers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {/* Actions */}
            <div className="flex gap-2">
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 text-sm transition-colors"
                  title="Limpiar filtros"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
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
          </div>

          {/* Results count */}
          <div className="text-sm text-zinc-500 mb-4">
            {isLoading ? (
              <span>Cargando...</span>
            ) : (
              <>
                {funds.length} fondo{funds.length !== 1 ? "s" : ""} encontrado{funds.length !== 1 ? "s" : ""}
                {debouncedSearch && ` para "${debouncedSearch}"`}
              </>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-green-400" />
              <span className="ml-3 text-zinc-500">Cargando fondos...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="h-10 w-10 text-amber-400 mb-3" />
              <p className="text-amber-400 font-medium">No se pudieron cargar los fondos</p>
              <p className="text-sm text-zinc-500 mt-1 max-w-md">
                {error instanceof Error ? error.message : "Intente nuevamente más tarde"}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
              >
                Reintentar
              </button>
            </div>
          ) : expired ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="h-10 w-10 text-amber-400 mb-3" />
              <p className="text-amber-400 font-medium">Sesión IOL expirada</p>
              <p className="text-sm text-zinc-500 mt-1">
                Reconecte su cuenta IOL en{" "}
                <Link href="/settings" className="text-blue-400 hover:underline">
                  Configuración
                </Link>
              </p>
            </div>
          ) : funds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Landmark className="h-10 w-10 text-zinc-500 mb-3" />
              <p className="text-zinc-400">No se encontraron fondos</p>
              <p className="text-sm text-zinc-500 mt-1">
                Intente con otros filtros o términos de búsqueda
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {funds.map((fund) => (
                <FundCard
                  key={fund.simbolo}
                  fund={fund}
                  isExpanded={expandedFund === fund.simbolo}
                  onToggle={() =>
                    setExpandedFund(
                      expandedFund === fund.simbolo ? null : fund.simbolo
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

function FundCard({
  fund,
  isExpanded,
  onToggle,
}: {
  fund: IOLFCIFund;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const change = fund.variacionPorcentual || 0;
  const isPositive = change >= 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-zinc-100 font-mono text-sm truncate">
              {fund.simbolo}
            </h3>
            <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5" title={fund.descripcion}>
              {fund.descripcion}
            </p>
          </div>
          {change !== 0 && (
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold shrink-0 ml-2",
                isPositive ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400"
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isPositive ? "+" : ""}{change.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
            {fund.tipoFondo}
          </span>
          <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
            {fund.moneda}
          </span>
          {fund.administradora && (
            <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-500 truncate max-w-[140px]">
              {fund.administradora}
            </span>
          )}
        </div>

        {/* Last value */}
        {fund.ultimoOperado != null && (
          <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between text-xs">
            <span className="text-zinc-500">Último operado</span>
            <span className="font-mono text-zinc-300">
              ${fund.ultimoOperado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={onToggle}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Menos detalles
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Más detalles
            </>
          )}
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && <FundDetails symbol={fund.simbolo} />}
    </div>
  );
}

function FundDetails({ symbol }: { symbol: string }) {
  const { data, isLoading, error } = useIOLFCIDetails(symbol);

  if (isLoading) {
    return (
      <div className="px-4 pb-4 flex items-center gap-2 text-xs text-zinc-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando detalles...
      </div>
    );
  }

  if (error || !data?.fund) {
    return (
      <div className="px-4 pb-4 text-xs text-zinc-500">
        No se pudieron cargar los detalles
      </div>
    );
  }

  const fund = data.fund;

  return (
    <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-2 text-xs">
      {fund.objetivoInversion && (
        <div>
          <span className="text-zinc-500 block">Objetivo</span>
          <span className="text-zinc-400">{fund.objetivoInversion}</span>
        </div>
      )}
      {fund.perfilInversor && (
        <div>
          <span className="text-zinc-500 block">Perfil inversor</span>
          <span className="text-zinc-400">{fund.perfilInversor}</span>
        </div>
      )}
      {fund.horizonteInversion && (
        <div>
          <span className="text-zinc-500 block">Horizonte</span>
          <span className="text-zinc-400">{fund.horizonteInversion}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {fund.rentabilidadAnual != null && (
          <div>
            <span className="text-zinc-500 block">Rend. anual</span>
            <span className={cn(
              "font-mono",
              fund.rentabilidadAnual >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {fund.rentabilidadAnual >= 0 ? "+" : ""}{fund.rentabilidadAnual.toFixed(2)}%
            </span>
          </div>
        )}
        {fund.rentabilidadMensual != null && (
          <div>
            <span className="text-zinc-500 block">Rend. mensual</span>
            <span className={cn(
              "font-mono",
              fund.rentabilidadMensual >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {fund.rentabilidadMensual >= 0 ? "+" : ""}{fund.rentabilidadMensual.toFixed(2)}%
            </span>
          </div>
        )}
        {fund.comisionAdministracion != null && (
          <div>
            <span className="text-zinc-500 block">Comisión adm.</span>
            <span className="font-mono text-zinc-400">
              {fund.comisionAdministracion.toFixed(2)}%
            </span>
          </div>
        )}
        {fund.montoMinimo != null && (
          <div>
            <span className="text-zinc-500 block">Monto mínimo</span>
            <span className="font-mono text-zinc-400">
              ${fund.montoMinimo.toLocaleString("es-AR")}
            </span>
          </div>
        )}
      </div>
      {fund.plazosRescate && (
        <div className="pt-1">
          <span className="text-zinc-500 block">Plazo de rescate</span>
          <span className="text-zinc-400">{fund.plazosRescate}</span>
        </div>
      )}
      {fund.patrimonio != null && (
        <div>
          <span className="text-zinc-500 block">Patrimonio</span>
          <span className="font-mono text-zinc-400">
            ${fund.patrimonio.toLocaleString("es-AR")}
          </span>
        </div>
      )}
    </div>
  );
}
