"use client";

import { useState, useMemo, useRef } from "react";
import {
  ArrowLeft,
  DollarSign,
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useIOLMep } from "@/hooks/useIOLMep";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function MepPage() {
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [debouncedAmount, setDebouncedAmount] = useState<number | undefined>();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const parsed = parseFloat(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedAmount(!isNaN(parsed) && parsed > 0 ? parsed : undefined);
    }, 500);
  };

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useIOLMep({ amount: debouncedAmount, direction });

  const { rate: blueRate, isLive: isBlueRateLive } = useExchangeRate();

  const pairs = data?.pairs || [];
  const averageRate = data?.averageRate || 0;
  const estimate = data?.estimate;

  // Compute diff vs blue dollar
  const mepVsBlue = useMemo(() => {
    if (!averageRate || !blueRate) return null;
    const diff = averageRate - blueRate;
    const pct = (diff / blueRate) * 100;
    return { diff, pct };
  }, [averageRate, blueRate]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-3 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al portfolio
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-100">Dólar MEP</h1>
                <p className="text-sm text-zinc-500">
                  Tipo de cambio implícito calculado a partir de bonos en ARS y USD
                </p>
              </div>
            </div>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
              <span className="ml-3 text-zinc-500">Cargando cotizaciones MEP...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="h-10 w-10 text-amber-400 mb-3" />
              <p className="text-amber-400 font-medium">No se pudo cargar la cotización</p>
              <p className="text-sm text-zinc-500 mt-1 max-w-md">
                {error instanceof Error && error.message.includes("500")
                  ? "El mercado puede estar cerrado. Disponible durante horario de mercado (11:00 - 17:00 ART)."
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
          ) : data?.expired ? (
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
          ) : pairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <DollarSign className="h-10 w-10 text-zinc-600 mb-3" />
              <p className="text-zinc-400">Sin cotizaciones disponibles</p>
              <p className="text-sm text-zinc-600 mt-1">
                El mercado puede estar cerrado o no hay liquidez en los bonos
              </p>
            </div>
          ) : (
            <>
              {/* Average Rate - Prominent */}
              <div className="bg-zinc-900/50 border border-yellow-500/30 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1">Dólar MEP Promedio</p>
                    <p className="text-4xl font-bold font-mono text-yellow-400">
                      ${averageRate.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Promedio de {pairs.length} par{pairs.length !== 1 ? "es" : ""} de bonos
                    </p>
                  </div>
                  <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Actualizar"
                  >
                    {isFetching ? (
                      <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-zinc-400" />
                    )}
                  </button>
                </div>

                {/* Comparison with Blue */}
                {mepVsBlue && (
                  <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-zinc-500">Dólar Blue (dolarapi.com): </span>
                      <span className="font-mono text-zinc-300">
                        ${blueRate.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </span>
                      {!isBlueRateLive && (
                        <span className="text-xs text-zinc-600 ml-1">(fallback)</span>
                      )}
                    </div>
                    <div className={cn(
                      "font-mono font-medium",
                      mepVsBlue.diff >= 0 ? "text-red-400" : "text-emerald-400"
                    )}>
                      {mepVsBlue.diff >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 inline mr-1" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 inline mr-1" />
                      )}
                      {mepVsBlue.diff >= 0 ? "+" : ""}{mepVsBlue.pct.toFixed(2)}% vs Blue
                    </div>
                  </div>
                )}
              </div>

              {/* Bond Pair Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {pairs.map((pair) => {
                  const diff = pair.implicitRate - averageRate;
                  const diffPct = averageRate > 0 ? (diff / averageRate) * 100 : 0;
                  return (
                    <div
                      key={pair.bond}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-zinc-100">{pair.bond}</h3>
                        <span className={cn(
                          "text-xs font-mono px-2 py-0.5 rounded",
                          diffPct >= 0
                            ? "bg-emerald-900/30 text-emerald-400"
                            : "bg-red-900/30 text-red-400"
                        )}>
                          {diffPct >= 0 ? "+" : ""}{diffPct.toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-2xl font-bold font-mono text-zinc-100 mb-3">
                        ${pair.implicitRate.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-zinc-600">{pair.arsSymbol} (ARS)</p>
                          <p className="font-mono text-zinc-400">
                            ${pair.arsPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-600">{pair.usdSymbol} (USD)</p>
                          <p className="font-mono text-zinc-400">
                            ${pair.usdPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Calculator */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-yellow-400" />
                  Calculadora MEP
                </h2>

                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  {/* Direction toggle */}
                  <div className="flex bg-zinc-800 rounded-lg p-1">
                    <button
                      onClick={() => setDirection("buy")}
                      className={cn(
                        "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                        direction === "buy"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Comprar USD
                    </button>
                    <button
                      onClick={() => setDirection("sell")}
                      className={cn(
                        "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                        direction === "sell"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Vender USD
                    </button>
                  </div>

                  {/* Amount input */}
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                      {direction === "buy" ? "USD" : "USD"}
                    </span>
                    <input
                      type="number"
                      placeholder={direction === "buy" ? "Monto en USD a comprar" : "Monto en USD a vender"}
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg
                               text-zinc-100 placeholder:text-zinc-600 font-mono
                               focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                    />
                  </div>
                </div>

                {/* Result */}
                {estimate && (
                  <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
                    {direction === "buy" ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Monto USD</span>
                          <span className="font-mono text-zinc-300">
                            USD {estimate.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Tipo de cambio</span>
                          <span className="font-mono text-zinc-300">
                            ${estimate.rate.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Comisión IOL ({(estimate.fee * 100).toFixed(1)}%)</span>
                          <span className="font-mono text-red-400">
                            +${estimate.feeAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-base font-semibold pt-2 border-t border-zinc-700">
                          <span className="text-zinc-300">Total ARS necesarios</span>
                          <span className="font-mono text-yellow-400">
                            ${estimate.arsRequired?.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Monto USD</span>
                          <span className="font-mono text-zinc-300">
                            USD {estimate.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Tipo de cambio</span>
                          <span className="font-mono text-zinc-300">
                            ${estimate.rate.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Comisión IOL ({(estimate.fee * 100).toFixed(1)}%)</span>
                          <span className="font-mono text-red-400">
                            -${estimate.feeAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-base font-semibold pt-2 border-t border-zinc-700">
                          <span className="text-zinc-300">Recibirías ARS</span>
                          <span className="font-mono text-yellow-400">
                            ${estimate.arsResult?.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!estimate && amount && (
                  <p className="text-xs text-zinc-600 mt-2">
                    Ingrese un monto válido para ver el cálculo
                  </p>
                )}

                <p className="text-xs text-zinc-600 mt-4">
                  * Cálculo estimativo. La comisión real puede variar. El tipo de cambio MEP se calcula como el cociente entre el precio en ARS y USD del mismo bono.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
