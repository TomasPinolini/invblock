"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { PortfolioRow } from "./columns";

interface PortfolioCardListProps {
  rows: PortfolioRow[];
  displayCurrency: "USD" | "ARS";
  onSelectAsset: (row: PortfolioRow) => void;
}

export function PortfolioCardList({
  rows,
  displayCurrency,
  onSelectAsset,
}: PortfolioCardListProps) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-zinc-600">
        No assets to display.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const pnlPositive = row.pnlPercent >= 0;
        const dailyPositive = row.dailyChange !== null ? row.dailyChange >= 0 : null;

        return (
          <div
            key={row.id}
            onClick={() => onSelectAsset(row)}
            className="card-elevated hover-lift px-4 py-3
                       cursor-pointer active:bg-zinc-800/60"
          >
            {/* Top row: Ticker + Name | Category badge */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-bold text-sm text-zinc-100">
                  {row.ticker}
                </span>
                <span className="text-xs text-zinc-500 truncate max-w-[120px]">
                  {row.name}
                </span>
              </div>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2"
                style={{
                  backgroundColor: `${CATEGORY_COLORS[row.category]}20`,
                  color: CATEGORY_COLORS[row.category],
                }}
              >
                {CATEGORY_LABELS[row.category]}
              </span>
            </div>

            {/* Bottom row: Price + daily change | Value | P&L */}
            <div className="flex items-center justify-between">
              {/* Price + daily change */}
              <div data-sensitive className="flex items-center gap-1">
                <span className="font-mono text-xs text-zinc-300">
                  {formatCurrency(row.displayPrice, displayCurrency)}
                </span>
                {row.hasLiveQuote && row.dailyChange !== null && (
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      dailyPositive ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {dailyPositive ? "\u25B2" : "\u25BC"}
                  </span>
                )}
              </div>

              {/* Value */}
              <span data-sensitive className="font-mono font-semibold text-sm text-zinc-100">
                {formatCurrency(row.displayValue, displayCurrency)}
              </span>

              {/* P&L % */}
              <span
                data-sensitive
                className={cn(
                  "inline-flex items-center gap-0.5 font-mono font-semibold text-xs",
                  pnlPositive ? "text-emerald-400" : "text-red-400"
                )}
              >
                {pnlPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {formatPercent(row.pnlPercent)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Skeleton placeholder for mobile card loading state */
export function PortfolioCardListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="h-4 w-14 animate-pulse rounded bg-zinc-700" />
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-700" />
            </div>
            <div className="h-4 w-14 animate-pulse rounded-full bg-zinc-700" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-700" />
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-700" />
            <div className="h-3 w-14 animate-pulse rounded bg-zinc-700" />
          </div>
        </div>
      ))}
    </div>
  );
}
