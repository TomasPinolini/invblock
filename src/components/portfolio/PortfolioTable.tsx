"use client";

import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Loader2,
  Settings,
  Filter,
  Download,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/useAppStore";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { buildColumns, buildActionsColumn, type PortfolioRow } from "./columns";
import { PortfolioTableSkeleton } from "./PortfolioTableSkeleton";
import { PortfolioCardList, PortfolioCardListSkeleton } from "./PortfolioCardList";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { downloadCSV } from "@/lib/csv";

// Lazy-load heavy modals — only rendered when user clicks a row / trade button
const AssetDetailModal = dynamic(() => import("./AssetDetailModal"), {
  ssr: false,
});
const TradeDialog = dynamic(() => import("./TradeDialog"), {
  ssr: false,
});

// ── Component ───────────────────────────────────────────────────────────────

export default function PortfolioTable() {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    displayCurrency,
    iolConnected,
    binanceConnected,
    anyConnected,
    iolExpired,
  } = usePortfolioData();

  const compact = useAppStore((s) => s.preferences.compactTable);
  const router = useRouter();

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

  // Handle category filter change
  const handleCategoryFilter = (category: string | null) => {
    setCategoryFilter(category);
    if (category) {
      setColumnFilters([{ id: "category", value: category }]);
    } else {
      setColumnFilters([]);
    }
  };

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

  const handleExportCSV = () => {
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    const headers = [
      "Ticker", "Name", "Category", "Currency", "Quantity",
      "Avg Price", "Current Price", "Value", "P&L ($)", "P&L (%)",
      "Allocation (%)", "Source",
    ];
    const csvRows = rows.map((r) => [
      r.ticker,
      r.name,
      CATEGORY_LABELS[r.category] ?? r.category,
      r.currency,
      String(r.quantity),
      r.displayAvgPrice.toFixed(2),
      r.displayPrice.toFixed(2),
      r.displayValue.toFixed(2),
      r.displayPnl.toFixed(2),
      r.pnlPercent.toFixed(2),
      r.allocation.toFixed(2),
      r.source,
    ]);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`portfolio-${date}.csv`, headers, csvRows);
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
      {/* ── Summary Bar (hidden on mobile - PortfolioSummary shows same info) ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden sm:block space-y-1">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Total Portfolio Value
          </p>
          <p data-sensitive className="text-xl sm:text-2xl font-bold font-mono text-zinc-50">
            {formatCurrency(totalValue, displayCurrency)}
          </p>
          <p
            data-sensitive
            className={cn(
              "text-sm font-mono font-semibold",
              totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {formatCurrency(totalPnl, displayCurrency)}{" "}
            ({formatPercent(totalPnlPct)})
            <span className="text-zinc-500 font-normal ml-2">total return</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:ml-auto">
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
              aria-label="Search portfolio assets"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 w-full sm:w-40 rounded-lg border border-zinc-800 bg-zinc-900/50
                         px-3 text-sm text-zinc-200 placeholder:text-zinc-600
                         focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            {data.length > 0 && (
              <button
                onClick={handleExportCSV}
                aria-label="Export portfolio as CSV"
                className="btn-secondary whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
            {anyConnected ? (
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh portfolio data"
                className="btn-secondary whitespace-nowrap disabled:opacity-50"
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
                aria-label={iolExpired ? "Reconnect broker account" : "Connect broker account"}
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

      {/* ── Mobile Card Layout ─────────────────────────────────────── */}
      <div className="sm:hidden">
        {isLoading ? (
          <PortfolioCardListSkeleton />
        ) : (
          <PortfolioCardList
            rows={table.getRowModel().rows.map((r) => r.original)}
            displayCurrency={displayCurrency}
            onSelectAsset={setSelectedAsset}
          />
        )}
      </div>

      {/* ── Desktop Table ─────────────────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto card-elevated backdrop-blur-sm">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="table-header-row">
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
                          asc: <span className="bg-blue-500/10 rounded px-1 py-0.5"><ArrowUp className="h-3 w-3 text-blue-400" /></span>,
                          desc: <span className="bg-blue-500/10 rounded px-1 py-0.5"><ArrowDown className="h-3 w-3 text-blue-400" /></span>,
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
              <PortfolioTableSkeleton columns={columns.length} />
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
              table.getRowModel().rows.map((row, rowIndex) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedAsset(row.original)}
                  className={cn(
                    "table-row-hover border-b border-zinc-800/30 cursor-pointer",
                    rowIndex % 2 === 1 && "table-row-even"
                  )}
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
      <div className="flex items-center justify-between text-xs text-zinc-600" aria-live="polite">
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
          onBuy={() => handleBuy(selectedAsset)}
          onSell={() => handleSell(selectedAsset)}
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
            market: tradeAsset.category === "stock" ? "nYSE" : "bCBA",
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
