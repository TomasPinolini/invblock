"use client";

import React, { useState } from "react";
import { X, TrendingUp, TrendingDown, Loader2, AlertCircle } from "lucide-react";
import { useTickerHistory } from "@/hooks/useHistoricalPrices";
import type { TimePeriod } from "@/services/yahoo/client";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/constants";

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

  // Fetch history for this specific ticker
  const { data: historyData, isLoading, error } = useTickerHistory(
    asset.ticker,
    asset.category,
    selectedPeriod
  );

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

  // Chart with axis labels
  const renderChart = () => {
    if (!historyData?.history?.length) return null;

    const history = historyData.history.filter((h) => h.close > 0);
    if (history.length < 2) return null;

    const prices = history.map((h) => h.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const width = 100;
    const height = 50;
    const points = prices.map((price, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((price - min) / range) * height;
      return `${x},${y}`;
    }).join(" ");

    const isPositive = prices[prices.length - 1] >= prices[0];
    const startDate = history[0]?.date;
    const endDate = history[history.length - 1]?.date;

    return (
      <div className="space-y-1">
        {/* Y-axis labels + Chart */}
        <div className="flex gap-2">
          {/* Y-axis */}
          <div className="flex flex-col justify-between text-[10px] font-mono text-zinc-500 w-12 text-right">
            <span>{formatAxisPrice(max)}</span>
            <span>{formatAxisPrice(min)}</span>
          </div>
          {/* Chart */}
          <div className="flex-1">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="0" x2={width} y2="0" stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
              <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
              <line x1="0" y1={height} x2={width} y2={height} stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
              {/* Price line */}
              <polyline
                fill="none"
                stroke={isPositive ? "#34d399" : "#f87171"}
                strokeWidth="2"
                points={points}
              />
            </svg>
          </div>
        </div>
        {/* X-axis labels */}
        <div className="flex justify-between text-[10px] font-mono text-zinc-500 pl-14">
          <span>{startDate ? formatAxisDate(startDate) : ""}</span>
          <span>{endDate ? formatAxisDate(endDate) : ""}</span>
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
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-2 sm:mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
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

          {/* Chart / Historical Data */}
          <div className="bg-zinc-800/50 rounded-lg p-3 min-h-[140px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-24">
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
                  {historyData.history.length} data points · Yahoo Finance
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
          Data from Yahoo Finance · Click outside to close
        </div>
      </div>
    </div>
  );
}
