"use client";

import React from "react";
import { X, TrendingUp, TrendingDown, Loader2, AlertCircle, Activity, Database, ShoppingCart, Banknote } from "lucide-react";
import type { TimePeriod } from "@/services/yahoo/client";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/constants";
import { useAssetDetail } from "@/hooks/useAssetDetail";
import PriceChart from "@/components/charts/PriceChart";
import TradingViewChart from "@/components/charts/TradingViewChart";

const TIME_PERIODS: TimePeriod[] = ["1D", "1W", "1M", "1Y", "5Y", "ALL"];

interface AssetDetailModalProps {
  asset: {
    ticker: string;
    name: string;
    category: "stock" | "cedear" | "crypto" | "cash";
    currency: "USD" | "ARS";
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    currentValue: number;
    source?: "iol" | "binance" | "ppi";
    dailyChange?: number | null;
    hasLiveQuote?: boolean;
  };
  displayCurrency: "USD" | "ARS";
  onClose: () => void;
  onBuy?: () => void;
  onSell?: () => void;
}

export default function AssetDetailModal({
  asset,
  displayCurrency,
  onClose,
  onBuy,
  onSell,
}: AssetDetailModalProps) {
  const {
    liveQuote,
    quoteLoading,
    historyData,
    isLoading,
    error,
    selectedPeriod,
    setSelectedPeriod,
    dataSource,
    setDataSource,
    periodPnl,
    totalPnl,
    totalPnlPercent,
    tvSymbol,
    isIOL,
  } = useAssetDetail(asset);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${asset.ticker} detail`}
        className="relative z-10 w-full max-w-lg mx-2 sm:mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto modal-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[asset.category] }}
            />
            <div>
              <h2 className="text-lg font-bold text-zinc-100">{asset.ticker}</h2>
              <p className="text-sm text-zinc-500">{asset.name}</p>
            </div>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full ml-2"
              style={{
                backgroundColor: `${CATEGORY_COLORS[asset.category]}20`,
                color: CATEGORY_COLORS[asset.category],
              }}
            >
              {CATEGORY_LABELS[asset.category]}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Current Holdings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Precio Actual</p>
              <p className="text-xl font-bold font-mono text-zinc-100">
                {formatCurrency(asset.currentPrice, asset.currency)}
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Valor Posicion</p>
              <p className="text-xl font-bold font-mono text-zinc-100">
                {formatCurrency(asset.currentValue, displayCurrency)}
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Cantidad</p>
              <p className="text-lg font-mono text-zinc-200">{asset.quantity}</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Costo Prom.</p>
              <p className="text-lg font-mono text-zinc-200">
                {formatCurrency(asset.averagePrice, asset.currency)}
              </p>
            </div>
          </div>

          {/* Total P&L */}
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              Retorno Total (desde compra)
            </p>
            <div className="flex items-center gap-2">
              {totalPnl >= 0 ? (
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-400" />
              )}
              <span
                className={cn(
                  "text-xl font-bold font-mono",
                  totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {formatCurrency(totalPnl, displayCurrency)} ({formatPercent(totalPnlPercent)})
              </span>
            </div>
          </div>

          {/* Live Quote (IOL only) */}
          {isIOL && (
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-400" />
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Live Quote</p>
                {quoteLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
              </div>
              {liveQuote ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Today</span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        (liveQuote.variacion ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {(liveQuote.variacion ?? 0) >= 0 ? "+" : ""}
                      {(liveQuote.variacion ?? 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-700">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Open</p>
                      <p className="text-xs font-mono text-zinc-300">
                        {liveQuote.apertura ? formatCurrency(liveQuote.apertura, asset.currency) : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">High</p>
                      <p className="text-xs font-mono text-emerald-400">
                        {liveQuote.maximo ? formatCurrency(liveQuote.maximo, asset.currency) : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Low</p>
                      <p className="text-xs font-mono text-red-400">
                        {liveQuote.minimo ? formatCurrency(liveQuote.minimo, asset.currency) : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Prev Close</p>
                      <p className="text-xs font-mono text-zinc-300">
                        {liveQuote.cierreAnterior ? formatCurrency(liveQuote.cierreAnterior, asset.currency) : "--"}
                      </p>
                    </div>
                  </div>
                  {(liveQuote.volumenNominal || liveQuote.montoOperado) && (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
                      <span className="text-[10px] text-zinc-500 uppercase">Volume</span>
                      <span className="text-xs font-mono text-zinc-400">
                        {liveQuote.volumenNominal?.toLocaleString() ?? "--"} shares
                        {liveQuote.montoOperado && (
                          <span className="text-zinc-500 ml-2">
                            ({formatCurrency(liveQuote.montoOperado, asset.currency)})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {liveQuote.puntas && liveQuote.puntas.length > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
                      <span className="text-[10px] text-zinc-500 uppercase">Bid / Ask</span>
                      <span className="text-xs font-mono">
                        <span className="text-emerald-400">
                          {formatCurrency(liveQuote.puntas[0]?.precioCompra ?? 0, asset.currency)}
                        </span>
                        <span className="text-zinc-500 mx-1">/</span>
                        <span className="text-red-400">
                          {formatCurrency(liveQuote.puntas[0]?.precioVenta ?? 0, asset.currency)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              ) : !quoteLoading ? (
                <p className="text-xs text-zinc-500">Quote data unavailable</p>
              ) : null}
            </div>
          )}

          {/* Data Source + Time Period Selectors (hidden when TradingView is active) */}
          {!tvSymbol && (
            <div className="space-y-2">
              {isIOL && (
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-zinc-500" />
                  <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
                    <button
                      onClick={() => setDataSource("yahoo")}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                        dataSource === "yahoo"
                          ? "bg-zinc-700 text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Yahoo
                    </button>
                    <button
                      onClick={() => setDataSource("iol")}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                        dataSource === "iol"
                          ? "bg-blue-600 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      IOL
                    </button>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {dataSource === "iol" ? "Adjusted for AR market" : "Global data"}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1">
                {TIME_PERIODS.map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      selectedPeriod === period
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chart */}
          {tvSymbol ? (
            <div className="rounded-lg overflow-hidden">
              <TradingViewChart symbol={tvSymbol} height={380} />
            </div>
          ) : (
            <div className="bg-zinc-800/50 rounded-lg p-3 min-h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-24" aria-live="polite">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                  <span className="ml-2 text-sm text-zinc-500">Loading history...</span>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-24 text-red-400">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span className="text-sm">Failed to load historical data</span>
                </div>
              ) : historyData?.history?.length ? (
                <div>
                  <PriceChart
                    history={historyData.history}
                    currency={asset.currency}
                    chartId={`modal-${asset.ticker}`}
                  />

                  {periodPnl && (
                    <div className="mt-2 pt-2 border-t border-zinc-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">
                          {selectedPeriod} Return (from {formatCurrency(periodPnl.startPrice, asset.currency)})
                        </span>
                        <span
                          className={cn(
                            "text-sm font-bold font-mono",
                            periodPnl.pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"
                          )}
                        >
                          {formatPercent(periodPnl.pnlPercent)}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-zinc-500 mt-2">
                    {historyData.history.length} data points · {dataSource === "iol" ? "IOL (adjusted)" : "Yahoo Finance"}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-zinc-500">
                  <span className="text-sm">No historical data available for this period</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800 px-4 py-3 space-y-2">
          {isIOL && onBuy && onSell && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onClose();
                  onBuy();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg
                           bg-emerald-600/20 border border-emerald-500/30 text-emerald-400
                           hover:bg-emerald-600/30 active:bg-emerald-600/40
                           text-sm font-semibold transition-colors"
              >
                <ShoppingCart className="h-4 w-4" />
                Comprar
              </button>
              <button
                onClick={() => {
                  onClose();
                  onSell();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg
                           bg-red-600/20 border border-red-500/30 text-red-400
                           hover:bg-red-600/30 active:bg-red-600/40
                           text-sm font-semibold transition-colors"
              >
                <Banknote className="h-4 w-4" />
                Vender
              </button>
            </div>
          )}
          <p className="text-xs text-zinc-500 text-center">
            {tvSymbol ? "TradingView" : dataSource === "iol" ? "IOL (adjusted for AR market)" : "Yahoo Finance"} · Tap outside to close
          </p>
        </div>
      </div>
    </div>
  );
}
