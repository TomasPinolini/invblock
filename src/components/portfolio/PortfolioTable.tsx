"use client";

import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useIOLPortfolio, type IOLAsset } from "@/hooks/useIOLPortfolio";
import { useBinancePortfolio, type BinanceAsset } from "@/hooks/useBinancePortfolio";
import { useAppStore } from "@/stores/useAppStore";
import {
  MOCK_USD_ARS_RATE,
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

interface PortfolioRow {
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
  source: "iol" | "binance"; // Track data source
  allocation: number; // 0–100
  // Display values (converted to display currency)
  displayPrice: number;
  displayAvgPrice: number;
  displayValue: number;
  displayPnl: number;
}

// ── Column definitions ──────────────────────────────────────────────────────

const col = createColumnHelper<PortfolioRow>();

function buildColumns(displayCurrency: "USD" | "ARS") {
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
    }),

    col.accessor("name", {
      header: "Name",
      cell: (info) => (
        <span className="text-zinc-400 truncate max-w-[180px] block">
          {info.getValue()}
        </span>
      ),
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
    }),

    col.accessor("quantity", {
      header: "Qty",
      cell: (info) => (
        <span className="font-mono text-zinc-300">
          {formatQuantity(info.getValue())}
        </span>
      ),
    }),

    col.accessor("displayAvgPrice", {
      header: "Avg Cost",
      cell: (info) => (
        <span className="font-mono text-zinc-400">
          {formatCurrency(info.getValue(), displayCurrency)}
        </span>
      ),
    }),

    col.accessor("displayPrice", {
      header: "Price",
      cell: (info) => (
        <span className="font-mono text-zinc-200">
          {formatCurrency(info.getValue(), displayCurrency)}
        </span>
      ),
    }),

    col.accessor("displayValue", {
      header: "Value",
      cell: (info) => (
        <span className="font-mono font-semibold text-zinc-100">
          {formatCurrency(info.getValue(), displayCurrency)}
        </span>
      ),
    }),

    col.accessor("pnlPercent", {
      header: "P&L %",
      cell: (info) => {
        const v = info.getValue();
        const isPositive = v >= 0;
        return (
          <span
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
    }),
  ];
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PortfolioTable() {
  const { data: iolPortfolio, isLoading: iolLoading, error: iolError, refetch: refetchIOL, isFetching: iolFetching } = useIOLPortfolio();
  const { data: binancePortfolio, isLoading: binanceLoading, refetch: refetchBinance, isFetching: binanceFetching } = useBinancePortfolio();
  const displayCurrency = useAppStore((s) => s.preferences.displayCurrency);
  const compact = useAppStore((s) => s.preferences.compactTable);
  const router = useRouter();

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "displayValue", desc: true },
  ]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  // Combined loading/fetching state
  const isLoading = iolLoading || binanceLoading;
  const isFetching = iolFetching || binanceFetching;
  const error = iolError; // Show IOL error if any

  // Check connection states
  const iolConnected = iolPortfolio?.connected;
  const binanceConnected = binancePortfolio?.connected;
  const anyConnected = iolConnected || binanceConnected;
  const iolExpired = iolPortfolio?.expired;

  // Refetch both portfolios
  const refetch = () => {
    refetchIOL();
    refetchBinance();
  };

  // ── Convert values to display currency and merge data ──────────────────────────────────

  const data: PortfolioRow[] = useMemo(() => {
    const convertToDisplay = (value: number, assetCurrency: string) => {
      if (assetCurrency === displayCurrency) return value;
      if (assetCurrency === "ARS" && displayCurrency === "USD") {
        return value / MOCK_USD_ARS_RATE;
      }
      if (assetCurrency === "USD" && displayCurrency === "ARS") {
        return value * MOCK_USD_ARS_RATE;
      }
      return value;
    };

    const rows: PortfolioRow[] = [];

    // Add IOL assets
    if (iolPortfolio?.assets?.length) {
      for (const asset of iolPortfolio.assets) {
        rows.push({
          ...asset,
          source: "iol",
          displayPrice: convertToDisplay(asset.currentPrice, asset.currency),
          displayAvgPrice: convertToDisplay(asset.averagePrice, asset.currency),
          displayValue: convertToDisplay(asset.currentValue, asset.currency),
          displayPnl: convertToDisplay(asset.pnl, asset.currency),
          allocation: 0,
        });
      }
    }

    // Add Binance assets
    if (binancePortfolio?.assets?.length) {
      for (const asset of binancePortfolio.assets) {
        rows.push({
          ...asset,
          source: "binance",
          displayPrice: convertToDisplay(asset.currentPrice, asset.currency),
          displayAvgPrice: convertToDisplay(asset.averagePrice, asset.currency),
          displayValue: convertToDisplay(asset.currentValue, asset.currency),
          displayPnl: convertToDisplay(asset.pnl, asset.currency),
          allocation: 0,
        });
      }
    }

    // Calculate allocations
    const total = rows.reduce((sum, r) => sum + r.displayValue, 0);
    rows.forEach((r) => {
      r.allocation = total > 0 ? (r.displayValue / total) * 100 : 0;
    });

    return rows;
  }, [iolPortfolio, binancePortfolio, displayCurrency]);

  const columns = useMemo(
    () => buildColumns(displayCurrency),
    [displayCurrency]
  );

  // ── Table instance ────────────────────────────────────────────────────

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // ── Render ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6
                      text-red-400 text-sm">
        Failed to load portfolio: {error.message}
      </div>
    );
  }

  const totalValue = data.reduce((s, r) => s + r.displayValue, 0);
  const totalPnl = data.reduce((s, r) => s + r.displayPnl, 0);
  const totalCost = data.reduce((s, r) => s + r.displayAvgPrice * r.quantity, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* ── Summary Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Total Portfolio Value
          </p>
          <p className="text-2xl font-bold font-mono text-zinc-50">
            {formatCurrency(totalValue, displayCurrency)}
          </p>
          <p
            className={cn(
              "text-sm font-mono font-semibold",
              totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {formatCurrency(totalPnl, displayCurrency)}{" "}
            ({formatPercent(totalPnlPct)})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Global search */}
          <input
            type="text"
            placeholder="Search assets..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-9 w-48 rounded-lg border border-zinc-800 bg-zinc-900/50
                       px-3 text-sm text-zinc-200 placeholder:text-zinc-600
                       focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          {anyConnected ? (
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg
                         bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                         text-white text-sm font-medium transition-colors"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isFetching ? "Loading..." : "Refresh"}
            </button>
          ) : (
            <button
              onClick={() => router.push("/settings")}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-white text-sm font-medium transition-colors",
                iolExpired
                  ? "bg-amber-600 hover:bg-amber-500"
                  : "bg-blue-600 hover:bg-blue-500"
              )}
            >
              <Settings className="h-4 w-4" />
              {iolExpired ? "Reconnect" : "Connect Broker"}
            </button>
          )}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800/80
                      bg-zinc-950/50 backdrop-blur-sm">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-zinc-800/60">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={cn(
                      "px-4 text-left text-xs font-medium uppercase",
                      "tracking-wider text-zinc-500 select-none",
                      compact ? "py-2" : "py-3",
                      header.column.getCanSort() &&
                        "cursor-pointer hover:text-zinc-300 transition-colors"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: <ArrowUp className="h-3 w-3 text-blue-400" />,
                        desc: <ArrowDown className="h-3 w-3 text-blue-400" />,
                      }[header.column.getIsSorted() as string] ?? (
                        header.column.getCanSort() && (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/30">
                  {Array.from({ length: columns.length }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-zinc-600"
                >
                  {iolExpired ? (
                    <div className="space-y-2">
                      <p className="text-amber-400">Your IOL session has expired.</p>
                      <button
                        onClick={() => router.push("/settings")}
                        className="text-blue-400 hover:underline"
                      >
                        Click here to reconnect
                      </button>
                    </div>
                  ) : anyConnected ? (
                    "No assets found in your connected accounts."
                  ) : (
                    "Connect your broker accounts in Settings to view your portfolio."
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-800/30 hover:bg-zinc-800/20
                             transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn("px-4", compact ? "py-2" : "py-3")}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer Stats ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-zinc-600">
        <span>
          {data.length} asset{data.length !== 1 && "s"} ·{" "}
          {table.getFilteredRowModel().rows.length} shown
        </span>
        <span>
          {[
            iolConnected && "IOL",
            binanceConnected && "Binance",
          ].filter(Boolean).join(" + ") || "No connections"}{" "}
          · {isFetching ? "Updating..." : "Click Refresh for latest"}
        </span>
      </div>
    </div>
  );
}
