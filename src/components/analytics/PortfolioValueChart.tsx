"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { usePortfolioSnapshots } from "@/hooks/usePortfolioSnapshots";
import { formatCurrency } from "@/lib/utils";
import { Clock } from "lucide-react";

interface ChartPoint {
  date: string;
  label: string;
  value: number;
  cost: number;
}

export function PortfolioValueChart({ days = 90 }: { days?: number }) {
  const { data: response, isLoading } = usePortfolioSnapshots(days);

  const points: ChartPoint[] = useMemo(() => {
    if (!response?.snapshots?.length) return [];
    return response.snapshots.map((s) => ({
      date: s.snapshotDate,
      label: new Date(s.snapshotDate + "T12:00:00").toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
      }),
      value: parseFloat(s.totalValueUsd),
      cost: parseFloat(s.totalCostUsd),
    }));
  }, [response]);

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-400" />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-zinc-500">
        <Clock className="h-8 w-8 text-zinc-600" />
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-400">No historical data yet</p>
          <p className="text-xs mt-1">Snapshots are captured daily</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717a", fontSize: 11 }}
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
              const d = payload[0].payload as ChartPoint;
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm shadow-xl">
                  <p className="text-zinc-400 text-xs mb-1">{d.date}</p>
                  <p className="font-mono text-zinc-100">
                    {formatCurrency(d.value)}
                  </p>
                  <p className="font-mono text-zinc-500 text-xs">
                    Cost: {formatCurrency(d.cost)}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#valueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
