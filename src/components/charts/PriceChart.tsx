"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface PriceChartProps {
  history: { date: string; close: number }[];
  currency: "USD" | "ARS";
  /** Unique id suffix to avoid SVG gradient id collisions when multiple charts render */
  chartId?: string;
}

const formatAxisDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "short" });
  return `${day} ${month}`;
};

const formatAxisPrice = (price: number) => {
  if (price >= 1000) return `${(price / 1000).toFixed(1)}k`;
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
};

export default function PriceChart({ history, currency, chartId = "default" }: PriceChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const filtered = history.filter((h) => h.close > 0);
  if (filtered.length < 2) return null;

  const prices = filtered.map((h) => h.close);
  const dates = filtered.map((h) => h.date);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const padding = range * 0.05;
  const chartMin = min - padding;
  const chartMax = max + padding;
  const chartRange = chartMax - chartMin;

  const svgW = 500;
  const svgH = 200;

  const chartPoints = prices.map((price, i) => ({
    x: (i / (prices.length - 1)) * svgW,
    y: svgH - ((price - chartMin) / chartRange) * svgH,
    price,
    date: dates[i],
  }));

  const linePoints = chartPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `0,${svgH} ${linePoints} ${svgW},${svgH}`;

  const isPositive = prices[prices.length - 1] >= prices[0];
  const color = isPositive ? "#34d399" : "#f87171";

  const safeIndex =
    hoveredIndex !== null && hoveredIndex < chartPoints.length ? hoveredIndex : null;
  const hovered = safeIndex !== null ? chartPoints[safeIndex] : null;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(xRatio * (chartPoints.length - 1));
    setHoveredIndex(Math.max(0, Math.min(idx, chartPoints.length - 1)));
  };

  // Y-axis: 5 evenly spaced labels
  const yLabelCount = 5;
  const yLabels = Array.from({ length: yLabelCount }, (_, i) => {
    const price = chartMax - (i / (yLabelCount - 1)) * chartRange;
    return { price, yPct: (i / (yLabelCount - 1)) * 100 };
  });

  // X-axis: 5 evenly spaced date labels
  const xLabelCount = 5;
  const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
    const idx = Math.round((i / (xLabelCount - 1)) * (dates.length - 1));
    return dates[idx];
  });

  const gradientId = `chart-area-fill-${chartId}`;

  return (
    <div className="space-y-1.5">
      {/* Hover price display */}
      <div className="h-6 flex items-center gap-2">
        {hovered ? (
          <>
            <span className="text-sm font-mono font-bold text-zinc-100">
              {formatCurrency(hovered.price, currency)}
            </span>
            <span className="text-xs font-mono text-zinc-500">
              {hovered.date ? formatAxisDate(hovered.date) : ""}
            </span>
          </>
        ) : (
          <span className="text-xs text-zinc-500">Hover chart for details</span>
        )}
      </div>

      <div className="flex gap-2">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between text-[10px] font-mono text-zinc-500 w-14 text-right shrink-0 py-0.5">
          {yLabels.map((label, i) => (
            <span key={i}>{formatAxisPrice(label.price)}</span>
          ))}
        </div>

        {/* Chart area */}
        <div
          className="flex-1 relative cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-48"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="80%" stopColor={color} stopOpacity="0.05" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {yLabels.map((_, i) => (
              <line
                key={i}
                x1="0"
                y1={(i / (yLabelCount - 1)) * svgH}
                x2={svgW}
                y2={(i / (yLabelCount - 1)) * svgH}
                stroke="#27272a"
                strokeWidth="0.5"
              />
            ))}

            {/* Gradient area fill */}
            <polygon points={areaPoints} fill={`url(#${gradientId})`} />

            {/* Price line */}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2"
              points={linePoints}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          {/* Crosshair + dot (HTML overlay for correct aspect ratio) */}
          {hovered && (
            <>
              <div
                className="absolute top-0 bottom-0 w-px pointer-events-none"
                style={{
                  left: `${(hovered.x / svgW) * 100}%`,
                  backgroundColor: "#52525b",
                }}
              />
              <div
                className="absolute left-0 right-0 h-px pointer-events-none"
                style={{
                  top: `${(hovered.y / svgH) * 100}%`,
                  backgroundColor: "#52525b",
                }}
              />
              <div
                className="absolute w-3 h-3 rounded-full border-2 border-zinc-900 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${(hovered.x / svgW) * 100}%`,
                  top: `${(hovered.y / svgH) * 100}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}80`,
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-[10px] font-mono text-zinc-500 pl-16">
        {xLabels.map((date, i) => (
          <span key={i}>{date ? formatAxisDate(date) : ""}</span>
        ))}
      </div>
    </div>
  );
}
