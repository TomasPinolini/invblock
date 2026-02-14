"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, BarChart3, Loader2 } from "lucide-react";
import { useTopMovers } from "@/hooks/useAlphaVantage";
import { AVBudgetIndicator } from "./AVBudgetIndicator";
import { cn } from "@/lib/utils";
import type { AVTopMover } from "@/services/alphavantage";

type Tab = "gainers" | "losers" | "active";

const TABS: { key: Tab; label: string; icon: typeof TrendingUp }[] = [
  { key: "gainers", label: "Gainers", icon: TrendingUp },
  { key: "losers", label: "Losers", icon: TrendingDown },
  { key: "active", label: "Active", icon: BarChart3 },
];

function MoverRow({ mover, type }: { mover: AVTopMover; type: Tab }) {
  const pct = mover.changePercentage.replace("%", "");
  const isPositive = !pct.startsWith("-");

  return (
    <div className="flex items-center justify-between py-2 px-1">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-sm font-bold text-zinc-100 w-16 shrink-0">
          {mover.ticker}
        </span>
        <span className="font-mono text-sm text-zinc-400">
          ${parseFloat(mover.price).toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {type !== "active" && (
          <span
            className={cn(
              "font-mono text-xs font-semibold px-2 py-0.5 rounded",
              isPositive
                ? "bg-emerald-900/30 text-emerald-400"
                : "bg-red-900/30 text-red-400"
            )}
          >
            {isPositive ? "+" : ""}{pct}%
          </span>
        )}
        {type === "active" && (
          <span className="font-mono text-xs text-zinc-500">
            {parseInt(mover.volume).toLocaleString()} vol
          </span>
        )}
      </div>
    </div>
  );
}

export default function MarketMovers() {
  const [activeTab, setActiveTab] = useState<Tab>("gainers");
  const { data: response, isLoading, error } = useTopMovers();

  const movers = response?.data;
  const budget = response?.budget;

  const currentList: AVTopMover[] =
    activeTab === "gainers"
      ? movers?.topGainers ?? []
      : activeTab === "losers"
        ? movers?.topLosers ?? []
        : movers?.mostActivelyTraded ?? [];

  return (
    <div>
      {/* Budget */}
      <div className="flex justify-end mb-2">
        <AVBudgetIndicator budget={budget} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1 mb-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeTab === tab.key
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <span className="ml-2 text-sm text-zinc-500">Loading movers...</span>
        </div>
      ) : error || !movers ? (
        <div className="py-6 text-center">
          <p className="text-sm text-zinc-500">
            {budget?.isExhausted
              ? "Daily API limit reached. Resets at midnight UTC."
              : "Could not load market movers"}
          </p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-zinc-500">No data available</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50">
          {currentList.slice(0, 8).map((mover) => (
            <MoverRow key={mover.ticker} mover={mover} type={activeTab} />
          ))}
        </div>
      )}
    </div>
  );
}

// Re-export for standalone usage outside collapsible
export { MarketMovers };
