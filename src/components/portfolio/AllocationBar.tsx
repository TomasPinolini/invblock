"use client";

import { useIOLPortfolio } from "@/hooks/useIOLPortfolio";
import { useBinancePortfolio } from "@/hooks/useBinancePortfolio";
import { usePPIPortfolio } from "@/hooks/usePPIPortfolio";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type AssetCategory,
} from "@/lib/constants";

export default function AllocationBar() {
  const { data: iolPortfolio } = useIOLPortfolio();
  const { data: binancePortfolio } = useBinancePortfolio();
  const { data: ppiPortfolio } = usePPIPortfolio();
  const { convertToDisplay } = useCurrencyConversion();

  // Merge assets from all sources
  const allAssets = [
    ...(iolPortfolio?.assets ?? []),
    ...(binancePortfolio?.assets ?? []),
    ...(ppiPortfolio?.assets ?? []),
  ];

  // Calculate allocation by category from all connected sources
  const allocation = allAssets.reduce(
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

  // Hide on mobile - the Allocation card in PortfolioSummary shows same info
  if (allocation.total === 0) {
    return (
      <div className="hidden sm:block card-surface p-4">
        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
          Portfolio Allocation
        </p>
        <div className="h-3 rounded-full bg-zinc-800" />
        <p className="text-xs text-zinc-600 mt-2 text-center">
          Connect a broker to see allocation
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
    <div className="hidden sm:block card-surface p-4">
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
