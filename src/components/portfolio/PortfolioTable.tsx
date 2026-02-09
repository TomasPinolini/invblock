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
  Filter,
  ShoppingCart,
  Banknote,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useIOLPortfolio } from "@/hooks/useIOLPortfolio";
import { useBinancePortfolio } from "@/hooks/useBinancePortfolio";
import { useIOLQuotes } from "@/hooks/useIOLQuotes";
import { useAppStore } from "@/stores/useAppStore";
import AssetDetailModal from "./AssetDetailModal";
import TradeDialog from "./TradeDialog";
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
  // Live quote data
  dailyChange: number | null; // Daily change % from live quote
  hasLiveQuote: boolean; // Whether we have a live quote
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
        <span className="font-mono text-zinc-400">
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
          <div className="flex items-center gap-1.5">
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
        <span className="font-mono font-semibold text-zinc-100">
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
function buildActionsColumn(
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
          >
            <ShoppingCart className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onSell(row)}
            className="p-1.5 rounded-md bg-red-900/30 hover:bg-red-800/50
                       text-red-400 transition-colors"
            title="Vender"
          >
            <Banknote className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    },
    meta: { hideOnMobile: true },
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PortfolioTable() {
  const { data: iolPortfolio, isLoading: iolLoading, error: iolError, refetch: refetchIOL, isFetching: iolFetching } = useIOLPortfolio();
  const { data: binancePortfolio, isLoading: binanceLoading, refetch: refetchBinance, isFetching: binanceFetching } = useBinancePortfolio();
  const displayCurrency = useAppStore((s) => s.preferences.displayCurrency);
  const compact = useAppStore((s) => s.preferences.compactTable);
  const router = useRouter();

  // Prepare ticker list for live quotes (IOL assets only)
  const iolTickers = useMemo(() => {
    if (!iolPortfolio?.assets?.length) return [];
    return iolPortfolio.assets.map((a) => ({
      symbol: a.ticker,
      category: a.category,
    }));
  }, [iolPortfolio?.assets]);

  // Fetch live quotes for IOL assets
  const { data: quotesData } = useIOLQuotes(iolTickers, iolPortfolio?.connected ?? false);

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "displayValue", desc: true },
  ]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = React.useState<PortfolioRow | null>(null);
  const [tradeAsset, setTradeAsset] = React.useState<PortfolioRow | null>(null);
  const [tradeAction, setTradeAction] = React.useState<"buy" | "sell">("buy");

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

  // Handle category filter change
  const handleCategoryFilter = (category: string | null) => {
    setCategoryFilter(category);
    if (category) {
      setColumnFilters([{ id: "category", value: category }]);
    } else {
      setColumnFilters([]);
    }
  };

  // ── Convert values to display currency and merge data ──────────────────────────────────

  const data: PortfolioRow[] = useMemo(() => {
    const quotes = quotesData?.quotes || {};

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

    // Calculate P&L (total return since purchase)
    const calculatePnl = (currentPrice: number, averagePrice: number, quantity: number) => {
      const pnl = (currentPrice - averagePrice) * quantity;
      const pnlPercent = averagePrice > 0 ? ((currentPrice - averagePrice) / averagePrice) * 100 : 0;
      return { pnl, pnlPercent };
    };

    const rows: PortfolioRow[] = [];

    // Add IOL assets
    if (iolPortfolio?.assets?.length) {
      for (const asset of iolPortfolio.assets) {
        // Get live quote if available
        const quote = quotes[asset.ticker.toUpperCase()];
        const livePrice = quote?.ultimoPrecio ?? asset.currentPrice;
        const liveValue = livePrice * asset.quantity;
        const dailyChange = quote?.variacionPorcentual ?? null;

        const { pnl, pnlPercent } = calculatePnl(livePrice, asset.averagePrice, asset.quantity);
        rows.push({
          ...asset,
          currentPrice: livePrice,
          currentValue: liveValue,
          pnl,
          pnlPercent,
          source: "iol",
          displayPrice: convertToDisplay(livePrice, asset.currency),
          displayAvgPrice: convertToDisplay(asset.averagePrice, asset.currency),
          displayValue: convertToDisplay(liveValue, asset.currency),
          displayPnl: convertToDisplay(pnl, asset.currency),
          allocation: 0,
          dailyChange,
          hasLiveQuote: !!quote,
        });
      }
    }

    // Add Binance assets (no IOL quotes for crypto)
    if (binancePortfolio?.assets?.length) {
      for (const asset of binancePortfolio.assets) {
        const { pnl, pnlPercent } = calculatePnl(asset.currentPrice, asset.averagePrice, asset.quantity);
        rows.push({
          ...asset,
          pnl,
          pnlPercent,
          source: "binance",
          displayPrice: convertToDisplay(asset.currentPrice, asset.currency),
          displayAvgPrice: convertToDisplay(asset.averagePrice, asset.currency),
          displayValue: convertToDisplay(asset.currentValue, asset.currency),
          displayPnl: convertToDisplay(pnl, asset.currency),
          allocation: 0,
          dailyChange: null, // Binance doesn't provide daily change through this endpoint
          hasLiveQuote: false,
        });
      }
    }

    // Calculate allocations
    const total = rows.reduce((sum, r) => sum + r.displayValue, 0);
    rows.forEach((r) => {
      r.allocation = total > 0 ? (r.displayValue / total) * 100 : 0;
    });

    return rows;
  }, [iolPortfolio, binancePortfolio, displayCurrency, quotesData]);

  // Get unique categories from data for filter buttons
  const availableCategories = useMemo(() => {
    const categories = new Set(data.map((row) => row.category));
    return Array.from(categories) as ("stock" | "cedear" | "crypto" | "cash")[];
  }, [data]);

  // Handlers for trade buttons
  const handleBuy = (row: PortfolioRow) => {
    setTradeAsset(row);
    setTradeAction("buy");
  };

  const handleSell = (row: PortfolioRow) => {
    setTradeAsset(row);
    setTradeAction("sell");
  };

  const columns = useMemo(
    () => [...buildColumns(displayCurrency), buildActionsColumn(handleBuy, handleSell)],
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Total Portfolio Value
          </p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-zinc-50">
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
            <span className="text-zinc-500 font-normal ml-2 hidden sm:inline">total return</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Category filter buttons - hidden on mobile */}
          <div className="hidden md:flex items-center gap-1 mr-2">
            <Filter className="h-4 w-4 text-zinc-500" />
            <button
              onClick={() => handleCategoryFilter(null)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                categoryFilter === null
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              )}
            >
              All
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryFilter(cat)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  categoryFilter === cat
                    ? "text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
                style={{
                  backgroundColor:
                    categoryFilter === cat
                      ? `${CATEGORY_COLORS[cat]}40`
                      : undefined,
                  color: categoryFilter === cat ? CATEGORY_COLORS[cat] : undefined,
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2">
            {/* Global search */}
            <input
              type="text"
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 w-full sm:w-40 rounded-lg border border-zinc-800 bg-zinc-900/50
                         px-3 text-sm text-zinc-200 placeholder:text-zinc-600
                         focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            {anyConnected ? (
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg
                           bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                           text-white text-sm font-medium transition-colors whitespace-nowrap"
              >
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{isFetching ? "Loading..." : "Refresh"}</span>
              </button>
            ) : (
              <button
                onClick={() => router.push("/settings")}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-white text-sm font-medium transition-colors whitespace-nowrap",
                  iolExpired
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-blue-600 hover:bg-blue-500"
                )}
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">{iolExpired ? "Reconnect" : "Connect"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800/80
                      bg-zinc-950/50 backdrop-blur-sm">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-zinc-800/60">
                {hg.headers.map((header) => {
                  const hideOnMobile = (header.column.columnDef.meta as { hideOnMobile?: boolean })?.hideOnMobile;
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        "px-2 sm:px-4 text-left text-xs font-medium uppercase",
                        "tracking-wider text-zinc-500 select-none",
                        compact ? "py-2" : "py-3",
                        header.column.getCanSort() &&
                          "cursor-pointer hover:text-zinc-300 transition-colors",
                        hideOnMobile && "hidden sm:table-cell"
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
                  );
                })}
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
                  onClick={() => setSelectedAsset(row.original)}
                  className="border-b border-zinc-800/30 hover:bg-zinc-800/20
                             transition-colors cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => {
                    const hideOnMobile = (cell.column.columnDef.meta as { hideOnMobile?: boolean })?.hideOnMobile;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-2 sm:px-4",
                          compact ? "py-2" : "py-3",
                          hideOnMobile && "hidden sm:table-cell"
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    );
                  })}
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
          <span className="text-zinc-700 ml-2">· Click row for details</span>
        </span>
        <span>
          {[
            iolConnected && "IOL",
            binanceConnected && "Binance",
          ].filter(Boolean).join(" + ") || "No connections"}{" "}
          · {isFetching ? "Updating..." : "Click Refresh for latest"}
        </span>
      </div>

      {/* ── Asset Detail Modal ─────────────────────────────────────────── */}
      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          displayCurrency={displayCurrency}
          onClose={() => setSelectedAsset(null)}
        />
      )}

      {/* ── Trade Dialog ─────────────────────────────────────────────────── */}
      {tradeAsset && (
        <TradeDialog
          asset={{
            ticker: tradeAsset.ticker,
            name: tradeAsset.name,
            category: tradeAsset.category,
            currency: tradeAsset.currency,
            quantity: tradeAsset.quantity,
            currentPrice: tradeAsset.currentPrice,
            market: tradeAsset.category === "cedear" ? "bCBA" : "bCBA",
          }}
          action={tradeAction}
          onClose={() => setTradeAsset(null)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
