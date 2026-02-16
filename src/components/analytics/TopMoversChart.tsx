"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { formatPercent, formatCurrency } from "@/lib/utils";

interface MoverData {
  ticker: string;
  pnlPercent: number;
  displayPnl: number;
  color: string;
}

const GREEN = "#10b981";
const RED = "#ef4444";

export function TopMoversChart() {
  const { data, isLoading, displayCurrency } = usePortfolioData();

  const movers: MoverData[] = useMemo(() => {
    if (!data.length) return [];

    const sorted = [...data]
      .filter((r) => r.category !== "cash" && r.pnlPercent !== 0)
      .sort((a, b) => b.pnlPercent - a.pnlPercent);

    const gainers = sorted.slice(0, 5);
    const losers = sorted.slice(-5).reverse();

    // Merge: gainers first, then losers (reversed so worst is at bottom)
    const combined = [...gainers, ...losers.reverse()];

    // Deduplicate
    const seen = new Set<string>();
    const result: MoverData[] = [];
    for (const r of combined) {
      if (seen.has(r.ticker)) continue;
      seen.add(r.ticker);
      result.push({
        ticker: r.ticker,
        pnlPercent: r.pnlPercent,
        displayPnl: r.displayPnl,
        color: r.pnlPercent >= 0 ? GREEN : RED,
      });
    }

    return result.sort((a, b) => b.pnlPercent - a.pnlPercent);
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
      </div>
    );
  }

  if (movers.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm">
        No positions with P&L data
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={movers}
          layout="vertical"
          margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          />
          <YAxis
            type="category"
            dataKey="ticker"
            tick={{ fill: "#a1a1aa", fontSize: 12, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as MoverData;
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm shadow-xl">
                  <p className="font-mono font-medium text-zinc-100">{d.ticker}</p>
                  <p className="font-mono" style={{ color: d.color }}>
                    {formatPercent(d.pnlPercent)}
                  </p>
                  <p className="font-mono text-zinc-400 text-xs">
                    P&L: {formatCurrency(d.displayPnl, displayCurrency)}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="pnlPercent" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {movers.map((entry) => (
              <Cell key={entry.ticker} fill={entry.color} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
