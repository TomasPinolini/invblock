"use client";

import React from "react";
import {
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  Activity,
  Database,
  ShoppingCart,
  Banknote,
} from "lucide-react";
import type { TimePeriod } from "@/services/yahoo/client";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/constants";
import { useAssetDetail } from "@/hooks/useAssetDetail";
import PriceChart from "@/components/charts/PriceChart";
import TradingViewChart from "@/components/charts/TradingViewChart";
import type { PortfolioRow } from "./columns";

const TIME_PERIODS: TimePeriod[] = ["1D", "1W", "1M", "1Y", "5Y", "ALL"];

interface AssetExpandedRowProps {
  asset: PortfolioRow;
  displayCurrency: "USD" | "ARS";
  onCollapse: () => void;
  onBuy: () => void;
  onSell: () => void;
}

export default function AssetExpandedRow({
  asset,
  displayCurrency,
  onCollapse,
  onBuy,
  onSell,
}: AssetExpandedRowProps) {
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
    <div className="px-6 py-7 lg:px-8 lg:py-8 space-y-7 border-t border-zinc-700/50">
      {/* Header row: collapse button + ticker info */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCollapse();
            }}
            className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
            aria-label="Collapse row"
          >
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          </button>
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: CATEGORY_COLORS[asset.category] }}
          />
          <span className="font-mono font-bold text-lg text-zinc-100">{asset.ticker}</span>
          <span className="text-sm text-zinc-400">{asset.name}</span>
          <span
            className="text-xs font-medium px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: `${CATEGORY_COLORS[asset.category]}20`,
              color: CATEGORY_COLORS[asset.category],
            }}
          >
            {CATEGORY_LABELS[asset.category]}
          </span>
        </div>
      </div>

      {/* Main two-column layout: chart (left) + stats (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 lg:gap-8">
        {/* ── Left: Chart ────────────────────────────────── */}
        <div className="space-y-4">
          {/* Data source + period selectors (for SVG fallback) */}
          {!tvSymbol && (
            <div className="space-y-3">
              {isIOL && (
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-zinc-500" />
                  <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDataSource("yahoo"); }}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                        dataSource === "yahoo"
                          ? "bg-zinc-700 text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Yahoo
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDataSource("iol"); }}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
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
                    onClick={(e) => { e.stopPropagation(); setSelectedPeriod(period); }}
                    className={cn(
                      "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors",
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

          {/* Chart content */}
          {tvSymbol ? (
            <div className="rounded-lg overflow-hidden">
              <TradingViewChart symbol={tvSymbol} height={460} />
            </div>
          ) : (
            <div className="bg-zinc-800/30 rounded-lg p-5 min-h-[320px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-40" aria-live="polite">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                  <span className="ml-2 text-sm text-zinc-500">Loading history...</span>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-40 text-red-400">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span className="text-sm">Failed to load historical data</span>
                </div>
              ) : historyData?.history?.length ? (
                <div>
                  <PriceChart
                    history={historyData.history}
                    currency={asset.currency}
                    chartId={`expanded-${asset.ticker}`}
                  />
                  {periodPnl && (
                    <div className="mt-3 pt-3 border-t border-zinc-700">
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
                  <p className="text-[10px] text-zinc-500 mt-3">
                    {historyData.history.length} data points · {dataSource === "iol" ? "IOL (adjusted)" : "Yahoo Finance"}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-zinc-500">
                  <span className="text-sm">No historical data available for this period</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Stats & Actions ────────────────────── */}
        <div className="space-y-3">
          {/* Holdings stats */}
          <div className="space-y-2.5">
            <div className="bg-zinc-800/40 rounded-lg px-4 py-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Precio Actual</p>
              <p className="text-lg font-bold font-mono text-zinc-100">
                {formatCurrency(asset.currentPrice, asset.currency)}
              </p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg px-4 py-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Valor Posición</p>
              <p className="text-lg font-bold font-mono text-zinc-100">
                {formatCurrency(asset.currentValue, displayCurrency)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Cantidad</p>
                <p className="text-base font-mono text-zinc-200">{asset.quantity}</p>
              </div>
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Costo Prom.</p>
                <p className="text-base font-mono text-zinc-200">
                  {formatCurrency(asset.averagePrice, asset.currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Total P&L */}
          <div className="bg-zinc-800/40 rounded-lg px-4 py-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
              Retorno Total
            </p>
            <div className="flex items-center gap-2">
              {totalPnl >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <span
                className={cn(
                  "text-base font-bold font-mono",
                  totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {formatCurrency(totalPnl, displayCurrency)} ({formatPercent(totalPnlPercent)})
              </span>
            </div>
          </div>

          {/* Live Quote (IOL only) */}
          {isIOL && (
            <div className="bg-zinc-800/40 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-3.5 w-3.5 text-blue-400" />
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Live Quote</p>
                {quoteLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
              </div>
              {liveQuote ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Today</span>
                    <span
                      className={cn(
                        "font-mono font-semibold text-sm",
                        (liveQuote.variacion ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {(liveQuote.variacion ?? 0) >= 0 ? "+" : ""}
                      {(liveQuote.variacion ?? 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2.5 border-t border-zinc-700">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-zinc-500">Open</span>
                      <span className="text-xs font-mono text-zinc-300">
                        {liveQuote.apertura ? formatCurrency(liveQuote.apertura, asset.currency) : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-zinc-500">High</span>
                      <span className="text-xs font-mono text-emerald-400">
                        {liveQuote.maximo ? formatCurrency(liveQuote.maximo, asset.currency) : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-zinc-500">Low</span>
                      <span className="text-xs font-mono text-red-400">
                        {liveQuote.minimo ? formatCurrency(liveQuote.minimo, asset.currency) : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-zinc-500">Close</span>
                      <span className="text-xs font-mono text-zinc-300">
                        {liveQuote.cierreAnterior ? formatCurrency(liveQuote.cierreAnterior, asset.currency) : "--"}
                      </span>
                    </div>
                  </div>
                  {liveQuote.volumenNominal && (
                    <div className="flex items-center justify-between pt-2.5 border-t border-zinc-700">
                      <span className="text-[10px] text-zinc-500">Volume</span>
                      <span className="text-xs font-mono text-zinc-400">
                        {liveQuote.volumenNominal.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : !quoteLoading ? (
                <p className="text-xs text-zinc-500">Quote unavailable</p>
              ) : null}
            </div>
          )}

          {/* Trade buttons (IOL only) */}
          {isIOL && (
            <div className="flex gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBuy();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg
                           bg-emerald-600/20 border border-emerald-500/30 text-emerald-400
                           hover:bg-emerald-600/30 active:bg-emerald-600/40
                           text-sm font-semibold transition-colors"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Comprar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSell();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg
                           bg-red-600/20 border border-red-500/30 text-red-400
                           hover:bg-red-600/30 active:bg-red-600/40
                           text-sm font-semibold transition-colors"
              >
                <Banknote className="h-3.5 w-3.5" />
                Vender
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-zinc-500 pt-4 border-t border-zinc-800/50">
        <span>
          {tvSymbol ? "TradingView" : dataSource === "iol" ? "IOL (adjusted)" : "Yahoo Finance"}
        </span>
        <span>Click row to collapse</span>
      </div>
    </div>
  );
}
