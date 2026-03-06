"use client";

import React, { useMemo, useRef, useEffect } from "react";
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

// Lazy-load heavy components — only rendered when user interacts
const AssetExpandedRow = dynamic(() => import("./AssetExpandedRow"), {
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
    ppiConnected,
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
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
  const [tradeAsset, setTradeAsset] = React.useState<PortfolioRow | null>(null);
  const [tradeAction, setTradeAction] = React.useState<"buy" | "sell">("buy");

  // Reset expanded row if the asset disappears after data refetch
  React.useEffect(() => {
    if (expandedRowId && !data.some((r) => r.id === expandedRowId)) {
      setExpandedRowId(null);
    }
  }, [data, expandedRowId]);

  // Track table container width so expanded rows can pin to visible area
  const tableContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const update = () => {
      el.style.setProperty("--table-container-width", `${el.clientWidth}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
        Error al cargar el portfolio: {error.message}
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
            Valor Total del Portfolio
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
              placeholder="Buscar..."
              aria-label="Buscar activos del portfolio"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 w-full sm:w-40 rounded-lg border border-zinc-800 bg-zinc-900/50
                         px-3 text-sm text-zinc-200 placeholder:text-zinc-500
                         focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            {data.length > 0 && (
              <button
                onClick={handleExportCSV}
                aria-label="Exportar portfolio como CSV"
                className="btn-secondary whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            )}
            {anyConnected ? (
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Actualizar datos del portfolio"
                className="btn-secondary whitespace-nowrap disabled:opacity-50"
              >
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{isFetching ? "Cargando..." : "Actualizar"}</span>
              </button>
            ) : (
              <button
                onClick={() => router.push("/settings")}
                aria-label={iolExpired ? "Reconectar cuenta de broker" : "Conectar cuenta de broker"}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-white text-sm font-medium transition-colors whitespace-nowrap",
                  iolExpired
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-blue-600 hover:bg-blue-500"
                )}
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">{iolExpired ? "Reconectar" : "Conectar"}</span>
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
            expandedRowId={expandedRowId}
            onToggleExpand={(row) => setExpandedRowId((prev) => prev === row.id ? null : row.id)}
            onBuy={handleBuy}
            onSell={handleSell}
          />
        )}
      </div>

      {/* ── Desktop Table ─────────────────────────────────────────────── */}
      <div ref={tableContainerRef} className="hidden sm:block overflow-x-auto card-elevated backdrop-blur-sm">
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
                  className="px-4 py-12 text-center text-zinc-500"
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
              table.getRowModel().rows.map((row, rowIndex) => {
                const isExpanded = expandedRowId === row.original.id;
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedRowId((prev) => prev === row.original.id ? null : row.original.id)}
                      className={cn(
                        "table-row-hover border-b border-zinc-800/30 cursor-pointer",
                        rowIndex % 2 === 1 && "table-row-even",
                        isExpanded && "table-row-active"
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
                    {isExpanded && (
                      <tr className="table-row-expanded">
                        <td colSpan={columns.length} className="p-0">
                          <div className="sticky left-0 w-[var(--table-container-width,100vw)]">
                            <AssetExpandedRow
                              asset={row.original}
                              displayCurrency={displayCurrency}
                              onCollapse={() => setExpandedRowId(null)}
                              onBuy={() => handleBuy(row.original)}
                              onSell={() => handleSell(row.original)}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer Stats ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-zinc-500" aria-live="polite">
        <span>
          {data.length} asset{data.length !== 1 && "s"} ·{" "}
          {table.getFilteredRowModel().rows.length} shown
          <span className="text-zinc-700 ml-2">· Click row to expand</span>
        </span>
        <span>
          {[
            iolConnected && "IOL",
            binanceConnected && "Binance",
            ppiConnected && "PPI",
          ].filter(Boolean).join(" + ") || "No connections"}{" "}
          · {isFetching ? "Updating..." : "Click Refresh for latest"}
        </span>
      </div>

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
