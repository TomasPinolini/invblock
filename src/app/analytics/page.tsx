"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AllocationDonut } from "@/components/analytics/AllocationDonut";
import { PortfolioValueChart } from "@/components/analytics/PortfolioValueChart";
import { TopMoversChart } from "@/components/analytics/TopMoversChart";
import { CategoryBreakdownChart } from "@/components/analytics/CategoryBreakdownChart";

const PERIODS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
] as const;

function ChartCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(90);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple-500/15">
          <BarChart3 className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Analytics</h1>
          <p className="text-xs text-zinc-500">Portfolio insights and performance</p>
        </div>
      </div>

      {/* Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Allocation Donut */}
        <ErrorBoundary>
          <ChartCard title="Allocation by Category">
            <AllocationDonut />
          </ChartCard>
        </ErrorBoundary>

        {/* Portfolio Value (Historical) */}
        <ErrorBoundary>
          <ChartCard
            title="Portfolio Value"
            actions={
              <div className="flex items-center gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.days}
                    onClick={() => setSelectedPeriod(p.days)}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                      selectedPeriod === p.days
                        ? "bg-blue-500/20 text-blue-400"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            }
          >
            <PortfolioValueChart days={selectedPeriod} />
          </ChartCard>
        </ErrorBoundary>

        {/* Top Movers */}
        <ErrorBoundary>
          <ChartCard title="Top Movers (P&L %)">
            <TopMoversChart />
          </ChartCard>
        </ErrorBoundary>

        {/* Category Breakdown */}
        <ErrorBoundary>
          <ChartCard title="Cost vs Value by Category">
            <CategoryBreakdownChart />
          </ChartCard>
        </ErrorBoundary>
      </div>
    </div>
  );
}
