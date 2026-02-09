"use client";

import { useIOLPortfolio } from "@/hooks/useIOLPortfolio";
import { useAppStore } from "@/stores/useAppStore";
import {
  MOCK_USD_ARS_RATE,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type AssetCategory,
} from "@/lib/constants";

export default function AllocationBar() {
  const { data: portfolio } = useIOLPortfolio();
  const displayCurrency = useAppStore((s) => s.preferences.displayCurrency);

  // Convert value from asset's native currency to display currency
  const convertToDisplay = (value: number, assetCurrency: string) => {
    if (assetCurrency === displayCurrency) return value;
    if (assetCurrency === "ARS" && displayCurrency === "USD") {
      return value / MOCK_USD_ARS_RATE;
    }
    if (assetCurrency === "USD" && displayCurrency === "ARS") {
      return value * MOCK_USD_ARS_RATE;
    }
    return value;
  };

  // Calculate allocation by category from live IOL data
  const allocation = (portfolio?.assets ?? []).reduce(
    (acc, asset) => {
      const currentValue = convertToDisplay(asset.currentValue, asset.currency);

      acc.total += currentValue;
      if (!acc.byCategory[asset.category]) {
        acc.byCategory[asset.category] = 0;
      }
      acc.byCategory[asset.category] += currentValue;

      return acc;
    },
    {
      total: 0,
      byCategory: {} as Record<AssetCategory, number>,
    }
  );

  if (allocation.total === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
          Portfolio Allocation
        </p>
        <div className="h-3 rounded-full bg-zinc-800" />
        <p className="text-xs text-zinc-600 mt-2 text-center">
          Connect IOL to see allocation
        </p>
      </div>
    );
  }

  const categories = Object.entries(allocation.byCategory) as [
    AssetCategory,
    number
  ][];
  categories.sort((a, b) => b[1] - a[1]); // Sort by value desc

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
        Portfolio Allocation
      </p>

      {/* Stacked bar */}
      <div className="h-3 rounded-full bg-zinc-800 overflow-hidden flex">
        {categories.map(([category, value]) => {
          const pct = (value / allocation.total) * 100;
          return (
            <div
              key={category}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${pct}%`,
                backgroundColor: CATEGORY_COLORS[category],
              }}
              title={`${CATEGORY_LABELS[category]}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3">
        {categories.map(([category, value]) => {
          const pct = (value / allocation.total) * 100;
          return (
            <div key={category} className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[category] }}
              />
              <span className="text-xs text-zinc-400">
                {CATEGORY_LABELS[category]}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
