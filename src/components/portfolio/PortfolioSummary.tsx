"use client";

import { useIOLPortfolio } from "@/hooks/useIOLPortfolio";
import { useBinancePortfolio } from "@/hooks/useBinancePortfolio";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type AssetCategory,
} from "@/lib/constants";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet, PieChart, Activity } from "lucide-react";

export default function PortfolioSummary() {
  const { data: iolPortfolio } = useIOLPortfolio();
  const { data: binancePortfolio } = useBinancePortfolio();
  const { convertToDisplay, displayCurrency } = useCurrencyConversion();

  // Merge assets from both sources
  const allAssets = [
    ...(iolPortfolio?.assets ?? []),
    ...(binancePortfolio?.assets ?? []),
  ];

  // Calculate totals from all connected sources
  const summary = allAssets.reduce(
    (acc, asset) => {
      const currentValue = convertToDisplay(asset.currentValue, asset.currency);
      const costBasis = convertToDisplay(asset.averagePrice * asset.quantity, asset.currency);
      const pnl = convertToDisplay(asset.pnl, asset.currency);

      acc.totalValue += currentValue;
      acc.totalCost += costBasis;
      acc.totalPnl += pnl;

      // Group by category
      if (!acc.byCategory[asset.category]) {
        acc.byCategory[asset.category] = { value: 0, count: 0 };
      }
      acc.byCategory[asset.category].value += currentValue;
      acc.byCategory[asset.category].count += 1;

      return acc;
    },
    {
      totalValue: 0,
      totalCost: 0,
      totalPnl: 0,
      byCategory: {} as Record<AssetCategory, { value: number; count: number }>,
    }
  );

  const totalPnlPct =
    summary.totalCost > 0 ? (summary.totalPnl / summary.totalCost) * 100 : 0;
  const isPositive = summary.totalPnl >= 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Value */}
      <div className="card-prominent glow-blue hover-lift p-4">
        <div className="flex items-center gap-2 text-zinc-500 mb-2">
          <Wallet className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider">Total Value</span>
        </div>
        <p className="text-2xl font-bold font-mono text-zinc-50 animate-value-reveal">
          {formatCurrency(summary.totalValue, displayCurrency)}
        </p>
      </div>

      {/* P&L */}
      <div className={cn("card-prominent hover-lift p-4", isPositive ? "glow-emerald" : "glow-red")}>
        <div className="flex items-center gap-2 text-zinc-500 mb-2">
          <Activity className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider">Total P&L</span>
        </div>
        <p
          className={cn(
            "text-2xl font-bold font-mono animate-value-reveal",
            isPositive ? "text-emerald-400" : "text-red-400"
          )}
        >
          <span className="inline-flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
            {formatCurrency(Math.abs(summary.totalPnl), displayCurrency)}
          </span>
        </p>
        <p
          className={cn(
            "text-sm font-mono mt-1",
            isPositive ? "text-emerald-400/70" : "text-red-400/70"
          )}
        >
          {formatPercent(totalPnlPct)}
        </p>
      </div>

      {/* Cost Basis */}
      <div className="card-prominent hover-lift p-4">
        <div className="flex items-center gap-2 text-zinc-500 mb-2">
          <PieChart className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider">Cost Basis</span>
        </div>
        <p className="text-2xl font-bold font-mono text-zinc-50 animate-value-reveal">
          {formatCurrency(summary.totalCost, displayCurrency)}
        </p>
      </div>

      {/* Asset Count by Category */}
      <div className="card-prominent hover-lift p-4">
        <div className="flex items-center gap-2 text-zinc-500 mb-3">
          <span className="text-xs uppercase tracking-wider">Allocation</span>
        </div>
        <div className="space-y-2">
          {(Object.entries(summary.byCategory) as [AssetCategory, { value: number; count: number }][]).map(
            ([category, data]) => {
              const pct =
                summary.totalValue > 0
                  ? (data.value / summary.totalValue) * 100
                  : 0;
              return (
                <div key={category} className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[category] }}
                  />
                  <span className="text-xs text-zinc-400 flex-1">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <span className="text-xs font-mono text-zinc-300">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}
