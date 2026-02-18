"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Banknote,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from "@/lib/constants";
import {
  formatCurrency,
  formatPercent,
  formatQuantity,
  cn,
} from "@/lib/utils";

// ── Row type with allocation ─────────────────────────────────────────────────

export interface PortfolioRow {
  id: string;
  ticker: string;
  name: string;
  category: "stock" | "cedear" | "crypto" | "cash";
  currency: "USD" | "ARS";
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  source: "iol" | "binance" | "ppi";
  allocation: number; // 0–100
  // Display values (converted to display currency)
  displayPrice: number;
  displayAvgPrice: number;
  displayValue: number;
  displayPnl: number;
  // Live quote data
  dailyChange: number | null;
  hasLiveQuote: boolean;
}

// ── Column definitions ──────────────────────────────────────────────────────

const col = createColumnHelper<PortfolioRow>();

export function buildColumns(displayCurrency: "USD" | "ARS") {
  return [
    col.accessor("ticker", {
      header: "Ticker",
      cell: (info) => (
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor:
                CATEGORY_COLORS[info.row.original.category] ?? "#6b7280",
            }}
          />
          <span className="font-mono font-semibold text-zinc-100">
            {info.getValue()}
          </span>
        </div>
      ),
      meta: { hideOnMobile: false },
    }),

    col.accessor("name", {
      header: "Name",
      cell: (info) => (
        <span className="text-zinc-400 truncate max-w-[180px] block">
          {info.getValue()}
        </span>
      ),
      meta: { hideOnMobile: true },
    }),

    col.accessor("category", {
      header: "Category",
      cell: (info) => (
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${CATEGORY_COLORS[info.getValue()]}20`,
            color: CATEGORY_COLORS[info.getValue()],
          }}
        >
          {CATEGORY_LABELS[info.getValue()]}
        </span>
      ),
      filterFn: "equals",
      meta: { hideOnMobile: true },
    }),

    col.accessor("quantity", {
      header: "Qty",
      cell: (info) => (
        <span className="font-mono text-zinc-300">
          {formatQuantity(info.getValue())}
        </span>
      ),
      meta: { hideOnMobile: true },
    }),

    col.accessor("displayAvgPrice", {
      header: "Avg Cost",
      cell: (info) => (
        <span data-sensitive className="font-mono text-zinc-400">
          {formatCurrency(info.getValue(), displayCurrency)}
        </span>
      ),
      meta: { hideOnMobile: true },
    }),

    col.accessor("displayPrice", {
      header: "Price",
      cell: (info) => {
        const row = info.row.original;
        const change = row.dailyChange;
        const hasQuote = row.hasLiveQuote;
        return (
          <div data-sensitive className="flex items-center gap-1.5">
            <span className="font-mono text-zinc-200">
              {formatCurrency(info.getValue(), displayCurrency)}
            </span>
            {hasQuote && change !== null && (
              <span
                className={cn(
                  "text-xs font-mono",
                  change >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {change >= 0 ? "▲" : "▼"}
              </span>
            )}
          </div>
        );
      },
      meta: { hideOnMobile: false },
    }),

    col.accessor("dailyChange", {
      header: "Day",
      cell: (info) => {
        const v = info.getValue();
        if (v === null) {
          return <span className="text-zinc-600 text-xs">--</span>;
        }
        const isPositive = v >= 0;
        return (
          <span
            className={cn(
              "font-mono text-sm",
              isPositive ? "text-emerald-400" : "text-red-400"
            )}
          >
            {isPositive ? "+" : ""}
            {v.toFixed(2)}%
          </span>
        );
      },
      meta: { hideOnMobile: true },
    }),

    col.accessor("displayValue", {
      header: "Value",
      cell: (info) => (
        <span data-sensitive className="font-mono font-semibold text-zinc-100">
          {formatCurrency(info.getValue(), displayCurrency)}
        </span>
      ),
      meta: { hideOnMobile: false },
    }),

    col.accessor("pnlPercent", {
      header: "P&L %",
      cell: (info) => {
        const v = info.getValue();
        const isPositive = v >= 0;
        return (
          <span
            data-sensitive
            className={cn(
              "inline-flex items-center gap-1 font-mono font-semibold",
              isPositive ? "text-emerald-400" : "text-red-400"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {formatPercent(v)}
          </span>
        );
      },
      meta: { hideOnMobile: false },
    }),

    col.accessor("allocation", {
      header: "Alloc %",
      cell: (info) => {
        const v = info.getValue();
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${Math.min(v, 100)}%` }}
              />
            </div>
            <span className="font-mono text-xs text-zinc-400">
              {v.toFixed(1)}%
            </span>
          </div>
        );
      },
      meta: { hideOnMobile: true },
    }),
  ];
}

// Actions column (separate to pass callbacks)
export function buildActionsColumn(
  onBuy: (row: PortfolioRow) => void,
  onSell: (row: PortfolioRow) => void
) {
  return col.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const row = info.row.original;
      // Only show trade buttons for IOL assets (not crypto/binance)
      if (row.source !== "iol") {
        return null;
      }
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onBuy(row)}
            className="p-1.5 rounded-md bg-emerald-900/30 hover:bg-emerald-800/50
                       text-emerald-400 transition-colors"
            title="Comprar"
            aria-label={`Buy ${row.ticker}`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onSell(row)}
            className="p-1.5 rounded-md bg-red-900/30 hover:bg-red-800/50
                       text-red-400 transition-colors"
            title="Vender"
            aria-label={`Sell ${row.ticker}`}
          >
            <Banknote className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    },
    meta: { hideOnMobile: true },
  });
}
