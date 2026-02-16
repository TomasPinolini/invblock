"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type AssetCategory,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface CategoryData {
  category: AssetCategory;
  label: string;
  cost: number;
  value: number;
  color: string;
}

export function CategoryBreakdownChart() {
  const { data, isLoading, displayCurrency } = usePortfolioData();

  const categories: CategoryData[] = useMemo(() => {
    const grouped: Record<string, { cost: number; value: number }> = {};
    for (const row of data) {
      if (!grouped[row.category]) {
        grouped[row.category] = { cost: 0, value: 0 };
      }
      grouped[row.category].cost += row.displayAvgPrice * row.quantity;
      grouped[row.category].value += row.displayValue;
    }

    return Object.entries(grouped)
      .filter(([, v]) => v.value > 0 || v.cost > 0)
      .map(([cat, { cost, value }]) => ({
        category: cat as AssetCategory,
        label: CATEGORY_LABELS[cat as AssetCategory] || cat,
        cost,
        value,
        color: CATEGORY_COLORS[cat as AssetCategory] || "#6b7280",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-400" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm">
        No portfolio data available
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={categories}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
            }
            width={55}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as CategoryData;
              const pnl = d.value - d.cost;
              const pnlPct = d.cost > 0 ? ((pnl / d.cost) * 100).toFixed(1) : "0";
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm shadow-xl">
                  <p className="font-medium text-zinc-100 mb-1">{d.label}</p>
                  <p className="text-zinc-500">
                    Cost:{" "}
                    <span className="font-mono text-zinc-300">
                      {formatCurrency(d.cost, displayCurrency)}
                    </span>
                  </p>
                  <p className="text-zinc-500">
                    Value:{" "}
                    <span className="font-mono text-zinc-100">
                      {formatCurrency(d.value, displayCurrency)}
                    </span>
                  </p>
                  <p
                    className="font-mono text-xs mt-1"
                    style={{ color: pnl >= 0 ? "#10b981" : "#ef4444" }}
                  >
                    {pnl >= 0 ? "+" : ""}
                    {formatCurrency(pnl, displayCurrency)} ({pnlPct}%)
                  </p>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
            formatter={(value: string) => (
              <span className="text-zinc-400 text-xs">{value}</span>
            )}
          />
          <Bar
            dataKey="cost"
            name="Cost Basis"
            fill="#71717a"
            fillOpacity={0.6}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Bar
            dataKey="value"
            name="Current Value"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          >
            {categories.map((entry) => (
              <Cell key={entry.category} fill={entry.color} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
