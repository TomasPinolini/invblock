"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type AssetCategory,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface SliceData {
  category: AssetCategory;
  label: string;
  value: number;
  color: string;
}

export function AllocationDonut() {
  const { data, isLoading, displayCurrency } = usePortfolioData();

  const { slices, total } = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const row of data) {
      grouped[row.category] = (grouped[row.category] || 0) + row.displayValue;
    }

    const slices: SliceData[] = Object.entries(grouped)
      .filter(([, v]) => v > 0)
      .map(([cat, value]) => ({
        category: cat as AssetCategory,
        label: CATEGORY_LABELS[cat as AssetCategory] || cat,
        value,
        color: CATEGORY_COLORS[cat as AssetCategory] || "#6b7280",
      }))
      .sort((a, b) => b.value - a.value);

    const total = slices.reduce((s, d) => s + d.value, 0);
    return { slices, total };
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-purple-400" />
      </div>
    );
  }

  if (slices.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm">
        No portfolio data available
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {slices.map((entry) => (
                <Cell key={entry.category} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as SliceData;
                const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                return (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm shadow-xl">
                    <p className="font-medium text-zinc-100">{d.label}</p>
                    <p className="font-mono text-zinc-300">
                      {formatCurrency(d.value, displayCurrency)} ({pct}%)
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-zinc-500">Total</span>
          <span data-sensitive className="text-lg font-mono font-semibold text-zinc-100">
            {formatCurrency(total, displayCurrency)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {slices.map((s) => (
          <div key={s.category} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-zinc-400">{s.label}</span>
            <span className="font-mono text-zinc-500">
              {total > 0 ? ((s.value / total) * 100).toFixed(1) : "0"}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
