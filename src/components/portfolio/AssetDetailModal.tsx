"use client";

import React, { useState } from "react";
import { X, TrendingUp, TrendingDown, Loader2, AlertCircle, Activity, Database } from "lucide-react";
import { useTickerHistory } from "@/hooks/useHistoricalPrices";
import { useIOLQuote } from "@/hooks/useIOLQuotes";
import { useIOLHistorical, getDateRangeForPeriod } from "@/hooks/useIOLHistorical";
import type { TimePeriod } from "@/services/yahoo/client";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/constants";

type DataSource = "yahoo" | "iol";

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
    source?: "iol" | "binance";
    dailyChange?: number | null;
    hasLiveQuote?: boolean;
  };
  displayCurrency: "USD" | "ARS";
  onClose: () => void;
}

const TIME_PERIODS: TimePeriod[] = ["1D", "1W", "1M", "1Y", "5Y", "ALL"];

export default function AssetDetailModal({
  asset,
  displayCurrency,
  onClose,
}: AssetDetailModalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1M");
  const [dataSource, setDataSource] = useState<DataSource>("yahoo");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Fetch live quote for IOL assets
  const isIOL = asset.source === "iol";
  const { data: liveQuote, isLoading: quoteLoading } = useIOLQuote(
    asset.ticker,
    undefined,
    isIOL
  );

  // Calculate date range for IOL
  const dateRange = getDateRangeForPeriod(selectedPeriod);

  // Fetch history from Yahoo Finance
  const {
    data: yahooHistoryData,
    isLoading: yahooLoading,
    error: yahooError,
  } = useTickerHistory(
    asset.ticker,
    asset.category,
    selectedPeriod,
    dataSource === "yahoo"
  );

  // Fetch history from IOL (only for IOL assets and when IOL source selected)
  const {
    data: iolHistoryData,
    isLoading: iolLoading,
    error: iolError,
  } = useIOLHistorical({
    symbol: asset.ticker,
    category: asset.category,
    from: dateRange.from,
    to: dateRange.to,
    enabled: dataSource === "iol" && isIOL,
  });

  // Use the appropriate data based on selected source
  const historyData = dataSource === "yahoo" ? yahooHistoryData : iolHistoryData;
  const isLoading = dataSource === "yahoo" ? yahooLoading : iolLoading;
  const error = dataSource === "yahoo" ? yahooError : iolError;

  // Calculate P&L based on historical data
  const calculatePeriodPnl = () => {
    if (!historyData?.history?.length) {
      return null;
    }

    // Get the first price in the history (oldest)
    const startPrice = historyData.history[0]?.close;
    const endPrice = asset.currentPrice;

    if (!startPrice || startPrice <= 0) {
      return null;
    }

    const pnlPercent = ((endPrice - startPrice) / startPrice) * 100;
    const pnlValue = (endPrice - startPrice) * asset.quantity;

    return { startPrice, pnlPercent, pnlValue };
  };

  const periodPnl = calculatePeriodPnl();

  // Calculate total P&L (since purchase)
  const totalPnl = (asset.currentPrice - asset.averagePrice) * asset.quantity;
  const totalPnlPercent = asset.averagePrice > 0
    ? ((asset.currentPrice - asset.averagePrice) / asset.averagePrice) * 100
    : 0;

  // Format date for axis labels
  const formatAxisDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString("default", { month: "short" });
    return `${day} ${month}`;
  };

  // Format price for axis labels (compact)
  const formatAxisPrice = (price: number) => {
    if (price >= 1000) {
      return `${(price / 1000).toFixed(1)}k`;
    }
    if (price >= 1) {
      return price.toFixed(2);
    }
    return price.toFixed(4);
  };

  // Interactive chart with gradient fill, crosshair, and hover tooltip
  const renderChart = () => {
    if (!historyData?.history?.length) return null;

    const history = historyData.history.filter((h) => h.close > 0);
    if (history.length < 2) return null;

    const prices = history.map((h) => h.close);
    const dates = history.map((h) => h.date);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const padding = range * 0.05;
    const chartMin = min - padding;
    const chartMax = max + padding;
    const chartRange = chartMax - chartMin;

    const svgW = 500;
    const svgH = 200;

    const chartPoints = prices.map((price, i) => ({
      x: (i / (prices.length - 1)) * svgW,
      y: svgH - ((price - chartMin) / chartRange) * svgH,
      price,
      date: dates[i],
    }));

    const linePoints = chartPoints.map((p) => `${p.x},${p.y}`).join(" ");
    const areaPoints = `0,${svgH} ${linePoints} ${svgW},${svgH}`;

    const isPositive = prices[prices.length - 1] >= prices[0];
    const color = isPositive ? "#34d399" : "#f87171";

    const safeIndex =
      hoveredIndex !== null && hoveredIndex < chartPoints.length
        ? hoveredIndex
        : null;
    const hovered = safeIndex !== null ? chartPoints[safeIndex] : null;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const xRatio = (e.clientX - rect.left) / rect.width;
      const idx = Math.round(xRatio * (chartPoints.length - 1));
      setHoveredIndex(Math.max(0, Math.min(idx, chartPoints.length - 1)));
    };

    // Y-axis: 5 evenly spaced labels
    const yLabelCount = 5;
    const yLabels = Array.from({ length: yLabelCount }, (_, i) => {
      const price = chartMax - (i / (yLabelCount - 1)) * chartRange;
      return { price, yPct: (i / (yLabelCount - 1)) * 100 };
    });

    // X-axis: 5 evenly spaced date labels
    const xLabelCount = 5;
    const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
      const idx = Math.round((i / (xLabelCount - 1)) * (dates.length - 1));
      return dates[idx];
    });

    return (
      <div className="space-y-1.5">
        {/* Hover price display */}
        <div className="h-6 flex items-center gap-2">
          {hovered ? (
            <>
              <span className="text-sm font-mono font-bold text-zinc-100">
                {formatCurrency(hovered.price, asset.currency)}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                {hovered.date ? formatAxisDate(hovered.date) : ""}
              </span>
            </>
          ) : (
            <span className="text-xs text-zinc-500">Hover chart for details</span>
          )}
        </div>

        <div className="flex gap-2">
          {/* Y-axis labels */}
          <div className="flex flex-col justify-between text-[10px] font-mono text-zinc-500 w-14 text-right shrink-0 py-0.5">
            {yLabels.map((label, i) => (
              <span key={i}>{formatAxisPrice(label.price)}</span>
            ))}
          </div>

          {/* Chart area */}
          <div
            className="flex-1 relative cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-48"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="chart-area-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                  <stop offset="80%" stopColor={color} stopOpacity="0.05" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Horizontal grid lines */}
              {yLabels.map((_, i) => (
                <line
                  key={i}
                  x1="0"
                  y1={(i / (yLabelCount - 1)) * svgH}
                  x2={svgW}
                  y2={(i / (yLabelCount - 1)) * svgH}
                  stroke="#27272a"
                  strokeWidth="0.5"
                />
              ))}

              {/* Gradient area fill */}
              <polygon points={areaPoints} fill="url(#chart-area-fill)" />

              {/* Price line */}
              <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                points={linePoints}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>

            {/* Crosshair + dot (HTML overlay for correct aspect ratio) */}
            {hovered && (
              <>
                <div
                  className="absolute top-0 bottom-0 w-px pointer-events-none"
                  style={{
                    left: `${(hovered.x / svgW) * 100}%`,
                    backgroundColor: "#52525b",
                  }}
                />
                <div
                  className="absolute left-0 right-0 h-px pointer-events-none"
                  style={{
                    top: `${(hovered.y / svgH) * 100}%`,
                    backgroundColor: "#52525b",
                  }}
                />
                <div
                  className="absolute w-3 h-3 rounded-full border-2 border-zinc-900 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${(hovered.x / svgW) * 100}%`,
                    top: `${(hovered.y / svgH) * 100}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}80`,
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between text-[10px] font-mono text-zinc-500 pl-16">
          {xLabels.map((date, i) => (
            <span key={i}>{date ? formatAxisDate(date) : ""}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${asset.ticker} detail`}
        className="relative z-10 w-full max-w-lg mx-2 sm:mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
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
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Current Price</p>
              <p className="text-xl font-bold font-mono text-zinc-100">
                {formatCurrency(asset.currentPrice, asset.currency)}
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Position Value</p>
              <p className="text-xl font-bold font-mono text-zinc-100">
                {formatCurrency(asset.currentValue, displayCurrency)}
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Quantity</p>
              <p className="text-lg font-mono text-zinc-200">{asset.quantity}</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Avg Cost</p>
              <p className="text-lg font-mono text-zinc-200">
                {formatCurrency(asset.averagePrice, asset.currency)}
              </p>
            </div>
          </div>

          {/* Total P&L (since purchase) */}
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              Total Return (since purchase)
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

          {/* Live Quote Details (IOL only) */}
          {isIOL && (
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-400" />
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Live Quote</p>
                {quoteLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
              </div>
              {liveQuote ? (
                <div className="space-y-2">
                  {/* Daily Change */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Today</span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        (liveQuote.variacionPorcentual ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {(liveQuote.variacionPorcentual ?? 0) >= 0 ? "+" : ""}
                      {(liveQuote.variacionPorcentual ?? 0).toFixed(2)}%
                    </span>
                  </div>
                  {/* OHLC Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-700">
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase">Open</p>
                      <p className="text-xs font-mono text-zinc-300">
                        {liveQuote.apertura ? formatCurrency(liveQuote.apertura, asset.currency) : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase">High</p>
                      <p className="text-xs font-mono text-emerald-400">
                        {liveQuote.maximo ? formatCurrency(liveQuote.maximo, asset.currency) : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase">Low</p>
                      <p className="text-xs font-mono text-red-400">
                        {liveQuote.minimo ? formatCurrency(liveQuote.minimo, asset.currency) : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase">Prev Close</p>
                      <p className="text-xs font-mono text-zinc-300">
                        {liveQuote.cierreAnterior ? formatCurrency(liveQuote.cierreAnterior, asset.currency) : "--"}
                      </p>
                    </div>
                  </div>
                  {/* Volume */}
                  {(liveQuote.volumen || liveQuote.montoOperado) && (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
                      <span className="text-[10px] text-zinc-600 uppercase">Volume</span>
                      <span className="text-xs font-mono text-zinc-400">
                        {liveQuote.volumen?.toLocaleString() ?? "--"} shares
                        {liveQuote.montoOperado && (
                          <span className="text-zinc-600 ml-2">
                            ({formatCurrency(liveQuote.montoOperado, asset.currency)})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {/* Bid/Ask */}
                  {liveQuote.puntas && liveQuote.puntas.length > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
                      <span className="text-[10px] text-zinc-600 uppercase">Bid / Ask</span>
                      <span className="text-xs font-mono">
                        <span className="text-emerald-400">
                          {formatCurrency(liveQuote.puntas[0]?.precioCompra ?? 0, asset.currency)}
                        </span>
                        <span className="text-zinc-600 mx-1">/</span>
                        <span className="text-red-400">
                          {formatCurrency(liveQuote.puntas[0]?.precioVenta ?? 0, asset.currency)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              ) : !quoteLoading ? (
                <p className="text-xs text-zinc-600">Quote data unavailable</p>
              ) : null}
            </div>
          )}

          {/* Data Source + Time Period Selectors */}
          <div className="space-y-2">
            {/* Data Source Toggle (only for IOL assets) */}
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
                <span className="text-[10px] text-zinc-600">
                  {dataSource === "iol" ? "Adjusted for AR market" : "Global data"}
                </span>
              </div>
            )}

            {/* Time Period Selector */}
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

          {/* Chart / Historical Data */}
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
                {/* Chart with axes */}
                {renderChart()}

                {/* Period P&L */}
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

                <p className="text-[10px] text-zinc-600 mt-2">
                  {historyData.history.length} data points · {dataSource === "iol" ? "IOL (adjusted)" : "Yahoo Finance"}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-zinc-500">
                <span className="text-sm">No historical data available for this period</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800 text-xs text-zinc-600">
          Data from {dataSource === "iol" ? "IOL (adjusted for AR market)" : "Yahoo Finance"} · Click outside to close
        </div>
      </div>
    </div>
  );
}
