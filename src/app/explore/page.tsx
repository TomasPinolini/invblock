"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  Filter,
  RefreshCw,
  Star,
  Clock,
  X,
  Pencil,
  Check,
  Trash2,
  Compass,
} from "lucide-react";
import {
  useIOLSecurities,
  INSTRUMENT_TYPE_LABELS,
  MAIN_INSTRUMENT_TYPES,
} from "@/hooks/useIOLSecurities";
import type { IOLInstrumentType, IOLSecurityWithQuote } from "@/services/iol";
import {
  useWatchlist,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useUpdateWatchlistItem,
} from "@/hooks/useWatchlist";
import { useWatchlistPrices } from "@/hooks/useWatchlistPrices";
import type { WatchlistSecurity } from "@/hooks/useWatchlistPrices";
import { useTickerHistory } from "@/hooks/useHistoricalPrices";
import { useIOLHistorical, getDateRangeForPeriod } from "@/hooks/useIOLHistorical";
import type { TimePeriod } from "@/services/yahoo/client";
import { getBondMeta } from "@/lib/bond-metadata";
import dynamic from "next/dynamic";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";

const CompanyFundamentals = dynamic(
  () => import("@/components/market/CompanyFundamentals")
);
import type { AssetCategory } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { BondBadges } from "@/components/explore/BondBadges";
import { BondDetailPanel } from "@/components/explore/BondDetailPanel";

type ExploreTab = "favorites" | IOLInstrumentType | "all";

function mapInstrumentTypeToCategory(type: ExploreTab): AssetCategory {
  switch (type) {
    case "cedears":
      return "cedear";
    case "acciones":
      return "stock";
    default:
      return "stock";
  }
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    }>
      <ExplorePageInner />
    </Suspense>
  );
}

function ExplorePageInner() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "favorites" ? "favorites" : "cedears";
  const [activeTab, setActiveTab] = useState<ExploreTab>(initialTab);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSecurity, setSelectedSecurity] = useState<{
    security: IOLSecurityWithQuote;
    watchlistId?: string;
    category?: AssetCategory;
    notes?: string | null;
  } | null>(null);

  // Sync tab from URL on back/forward navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (searchParams.get("tab") === "favorites") setActiveTab("favorites");
  }, [searchParams]);

  const isFavoritesTab = activeTab === "favorites";

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setTimeout(() => setDebouncedSearch(value), 300);
  };

  // IOL securities (for non-favorites tabs)
  const iolInstrumentType =
    !isFavoritesTab && activeTab !== "all" ? (activeTab as IOLInstrumentType) : undefined;

  const {
    data: iolData,
    isLoading: iolLoading,
    error: iolError,
    refetch: iolRefetch,
    isFetching: iolFetching,
  } = useIOLSecurities({
    country: "argentina",
    instrumentType: iolInstrumentType,
    search: debouncedSearch || undefined,
    enabled: !isFavoritesTab,
  });

  // Watchlist prices (for favorites tab)
  const {
    data: favData,
    isLoading: favLoading,
    error: favError,
    refetch: favRefetch,
    isFetching: favFetching,
  } = useWatchlistPrices(isFavoritesTab);

  // Derived state
  const isLoading = isFavoritesTab ? favLoading : iolLoading;
  const error = isFavoritesTab ? favError : iolError;
  const isFetching = isFavoritesTab ? favFetching : iolFetching;
  const refetch = isFavoritesTab ? favRefetch : iolRefetch;
  const marketClosed = !isFavoritesTab && (iolData?.marketClosed === true);

  // Build unified securities list
  let securities: IOLSecurityWithQuote[] = [];
  const favMeta: Map<string, { watchlistId: string; category: AssetCategory; notes: string | null }> =
    new Map();

  if (isFavoritesTab && favData) {
    securities = favData.securities.map((s: WatchlistSecurity) => ({
      simbolo: s.simbolo,
      descripcion: s.descripcion,
      ultimoPrecio: s.ultimoPrecio,
      variacionPorcentual: s.variacionPorcentual,
      cierreAnterior: s.cierreAnterior,
    }));
    for (const s of favData.securities) {
      favMeta.set(s.simbolo, {
        watchlistId: s._watchlistId,
        category: s._category,
        notes: s._notes,
      });
    }
    // Apply client-side search filter for favorites
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      securities = securities.filter(
        (s) =>
          s.simbolo.toLowerCase().includes(q) ||
          s.descripcion.toLowerCase().includes(q)
      );
    }
  } else if (!isFavoritesTab && iolData) {
    securities = iolData.securities;
  }

  const handleCardClick = (security: IOLSecurityWithQuote) => {
    const meta = favMeta.get(security.simbolo);
    setSelectedSecurity({
      security,
      watchlistId: meta?.watchlistId,
      category: meta?.category,
      notes: meta?.notes,
    });
  };

  // Tab items: favorites first, then instrument types
  const TAB_ITEMS: { key: ExploreTab; label: string; icon?: typeof Star }[] = [
    { key: "favorites", label: "Favoritos", icon: Star },
    ...MAIN_INSTRUMENT_TYPES.map((type) => ({
      key: type as ExploreTab,
      label: INSTRUMENT_TYPE_LABELS[type],
    })),
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-zinc-100">Explorar Mercado</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Buscar y explorar instrumentos disponibles en IOL
            </p>
          </div>

          {/* Market closed banner */}
          {marketClosed && (
            <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <Clock className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-400">Mercado cerrado</p>
                <p className="text-xs text-zinc-500">
                  Se muestran precios del último cierre. Datos intradiarios disponibles en horario de mercado (11:00 - 17:00 ART).
                </p>
              </div>
            </div>
          )}

          {/* Search + Refresh */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder={isFavoritesTab ? "Buscar en favoritos..." : "Buscar por símbolo o nombre..."}
                aria-label="Buscar instrumentos"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Actualizar"
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
            <Filter className="h-4 w-4 text-zinc-500 mr-2 shrink-0" />
            {TAB_ITEMS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5",
                    activeTab === tab.key
                      ? tab.key === "favorites"
                        ? "bg-yellow-600 text-white"
                        : "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                  )}
                >
                  {Icon && <Icon className={cn("h-3.5 w-3.5", activeTab === tab.key && tab.key === "favorites" && "fill-white")} />}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Results Count */}
          <div className="text-sm text-zinc-500 mb-4">
            {isLoading ? (
              <span aria-live="polite">Cargando...</span>
            ) : (
              <>
                {securities.length} instrumento{securities.length !== 1 && "s"}
                {isFavoritesTab ? " en favoritos" : " encontrado" + (securities.length !== 1 ? "s" : "")}
                {debouncedSearch && ` para "${debouncedSearch}"`}
              </>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20" aria-live="polite">
              <Loader2 className={cn("h-8 w-8 animate-spin", isFavoritesTab ? "text-yellow-400" : "text-blue-400")} />
              <span className="ml-3 text-zinc-500">
                {isFavoritesTab ? "Cargando favoritos..." : "Cargando instrumentos..."}
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="h-10 w-10 text-amber-400 mb-3" />
              <p className="text-amber-400 font-medium">No se pudo cargar la lista</p>
              <p className="text-sm text-zinc-500 mt-1 max-w-md">
                {error instanceof Error ? error.message : "Intente nuevamente más tarde"}
              </p>
              <button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
                Reintentar
              </button>
            </div>
          ) : securities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              {isFavoritesTab ? (
                <>
                  <Star className="h-12 w-12 text-zinc-700 mb-4" />
                  <p className="text-zinc-400 text-lg font-medium">No tenés favoritos todavía</p>
                  <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                    Explorá instrumentos y tocá la estrella para agregarlos a tus favoritos.
                  </p>
                  <button
                    onClick={() => setActiveTab("cedears")}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Compass className="h-4 w-4" />
                    Explorar CEDEARs
                  </button>
                </>
              ) : (
                <>
                  <Search className="h-10 w-10 text-zinc-500 mb-3" />
                  <p className="text-zinc-400">No se encontraron instrumentos</p>
                  <p className="text-sm text-zinc-500 mt-1">Intente con otro filtro o término de búsqueda</p>
                </>
              )}
            </div>
          ) : (
            <SecurityGrid
              securities={securities}
              activeTab={activeTab}
              marketClosed={marketClosed}
              favMeta={favMeta}
              onCardClick={handleCardClick}
            />
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedSecurity && (
        <SecurityDetailModal
          security={selectedSecurity.security}
          watchlistId={selectedSecurity.watchlistId}
          category={selectedSecurity.category}
          notes={selectedSecurity.notes}
          priceMap={new Map(securities.map((s) => [s.simbolo, s.ultimoPrecio]))}
          onClose={() => setSelectedSecurity(null)}
        />
      )}
    </ErrorBoundary>
  );
}

// ── Security Grid ────────────────────────────────────────────────────────

function SecurityGrid({
  securities,
  activeTab,
  marketClosed,
  favMeta,
  onCardClick,
}: {
  securities: IOLSecurityWithQuote[];
  activeTab: ExploreTab;
  marketClosed: boolean;
  favMeta: Map<string, { watchlistId: string; category: AssetCategory; notes: string | null }>;
  onCardClick: (security: IOLSecurityWithQuote) => void;
}) {
  const { data: watchlistItems } = useWatchlist();
  const addMutation = useAddToWatchlist();
  const removeMutation = useRemoveFromWatchlist();

  const watchlistTickers = new Map(
    (watchlistItems || []).map((item) => [item.ticker, item.id])
  );

  const toggleWatchlist = (e: React.MouseEvent, security: IOLSecurityWithQuote) => {
    e.stopPropagation();
    const existingId =
      favMeta.get(security.simbolo)?.watchlistId || watchlistTickers.get(security.simbolo);
    if (existingId) {
      removeMutation.mutate(existingId);
    } else {
      addMutation.mutate({
        ticker: security.simbolo,
        name: security.descripcion,
        category: mapInstrumentTypeToCategory(activeTab),
      });
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {securities.map((security) => {
        const isInWatchlist =
          favMeta.has(security.simbolo) || watchlistTickers.has(security.simbolo);
        return (
          <SecurityCard
            key={security.simbolo}
            security={security}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={(e) => toggleWatchlist(e, security)}
            isToggling={addMutation.isPending || removeMutation.isPending}
            marketClosed={marketClosed}
            onClick={() => onCardClick(security)}
          />
        );
      })}
    </div>
  );
}

// ── Security Card ────────────────────────────────────────────────────────

function SecurityCard({
  security,
  isInWatchlist,
  onToggleWatchlist,
  isToggling,
  marketClosed,
  onClick,
}: {
  security: IOLSecurityWithQuote;
  isInWatchlist: boolean;
  onToggleWatchlist: (e: React.MouseEvent) => void;
  isToggling: boolean;
  marketClosed: boolean;
  onClick: () => void;
}) {
  const change = security.variacionPorcentual || 0;
  const isPositive = change >= 0;
  const hasPrice = security.ultimoPrecio > 0;

  return (
    <div
      onClick={onClick}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-zinc-100 font-mono">{security.simbolo}</h3>
          <p className="text-xs text-zinc-500 line-clamp-1" title={security.descripcion}>
            {security.descripcion}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleWatchlist}
            disabled={isToggling}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isInWatchlist
                ? "text-yellow-400 hover:bg-yellow-500/10"
                : "text-zinc-500 hover:text-yellow-400 hover:bg-yellow-500/10"
            )}
            title={isInWatchlist ? "Quitar de favoritos" : "Agregar a favoritos"}
            aria-label={isInWatchlist ? `Remove ${security.simbolo} from favorites` : `Add ${security.simbolo} to favorites`}
          >
            <Star className={cn("h-4 w-4", isInWatchlist && "fill-yellow-400")} />
          </button>
          {hasPrice && (
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-mono font-semibold",
                isPositive ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400"
              )}
            >
              {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {isPositive ? "+" : ""}
              {change.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Price */}
      {hasPrice ? (
        <div className="mb-3">
          <p className="text-2xl font-bold font-mono text-zinc-100">
            {security.moneda === "USD" ? "US$" : "$"}{security.ultimoPrecio.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      ) : (
        <div className="mb-3">
          <p className="text-sm text-zinc-500 italic">Precio no disponible</p>
        </div>
      )}

      {/* Bond/ON badges */}
      <BondBadges ticker={security.simbolo} currentPrice={security.ultimoPrecio} />

      {/* OHLC — only when market is open and data exists */}
      {!marketClosed && security.apertura != null && (
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <p className="text-zinc-500 uppercase">Apertura</p>
            <p className="font-mono text-zinc-400">{security.apertura?.toLocaleString("es-AR") || "--"}</p>
          </div>
          <div>
            <p className="text-zinc-500 uppercase">Máximo</p>
            <p className="font-mono text-emerald-400">{security.maximo?.toLocaleString("es-AR") || "--"}</p>
          </div>
          <div>
            <p className="text-zinc-500 uppercase">Mínimo</p>
            <p className="font-mono text-red-400">{security.minimo?.toLocaleString("es-AR") || "--"}</p>
          </div>
          <div>
            <p className="text-zinc-500 uppercase">Anterior</p>
            <p className="font-mono text-zinc-400">{security.cierreAnterior?.toLocaleString("es-AR") || "--"}</p>
          </div>
        </div>
      )}

      {/* Volume */}
      {!marketClosed && security.volumen != null && security.volumen > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between text-xs">
          <span className="text-zinc-500">Volumen</span>
          <span className="font-mono text-zinc-400">{security.volumen.toLocaleString("es-AR")} acciones</span>
        </div>
      )}
    </div>
  );
}

// ── Detail Modal ─────────────────────────────────────────────────────────

const TIME_PERIODS: TimePeriod[] = ["1W", "1M", "1Y", "5Y"];

function SecurityDetailModal({
  security,
  watchlistId,
  category,
  notes: initialNotes,
  priceMap,
  onClose,
}: {
  security: IOLSecurityWithQuote;
  watchlistId?: string;
  category?: AssetCategory;
  notes?: string | null;
  priceMap?: Map<string, number>;
  onClose: () => void;
}) {
  const { data: watchlistItems } = useWatchlist();
  const addMutation = useAddToWatchlist();
  const removeMutation = useRemoveFromWatchlist();
  const updateMutation = useUpdateWatchlistItem();

  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1M");
  const [editingNotes, setEditingNotes] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Resolve watchlist membership (may have changed since props were set)
  const wlItem = (watchlistItems || []).find((i) => i.ticker === security.simbolo);
  const isInWatchlist = !!wlItem;
  const resolvedCategory = wlItem?.category ?? category ?? "stock";
  const resolvedNotes = wlItem?.notes ?? initialNotes ?? null;
  const resolvedId = wlItem?.id ?? watchlistId;

  const [notesValue, setNotesValue] = useState(resolvedNotes || "");

  // Sync notes when watchlist data updates
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editingNotes) setNotesValue(resolvedNotes || "");
  }, [resolvedNotes, editingNotes]);

  // Use IOL historical for bonds/ONs, Yahoo Finance for stocks/CEDEARs
  const isBond = !!getBondMeta(security.simbolo);
  const iolDateRange = getDateRangeForPeriod(selectedPeriod);

  const {
    data: yahooData,
    isLoading: yahooLoading,
    error: yahooError,
  } = useTickerHistory(security.simbolo, resolvedCategory, selectedPeriod, !isBond);

  const {
    data: iolData,
    isLoading: iolLoading,
    error: iolError,
  } = useIOLHistorical({
    symbol: security.simbolo,
    from: iolDateRange.from,
    to: iolDateRange.to,
    enabled: isBond,
  });

  const historyData = isBond ? iolData : yahooData;
  const chartLoading = isBond ? iolLoading : yahooLoading;
  const chartError = isBond ? iolError : yahooError;

  const history = historyData?.history?.filter((h) => h.close > 0) ?? [];
  const currentPrice = history.length > 0 ? history[history.length - 1].close : security.ultimoPrecio > 0 ? security.ultimoPrecio : null;
  const startPrice = history.length > 0 ? history[0].close : null;
  const periodChange =
    currentPrice && startPrice && startPrice > 0
      ? ((currentPrice - startPrice) / startPrice) * 100
      : null;

  // Use actual currency from Yahoo data → security.moneda → category-based guess
  const yahooResolvedCurrency = (yahooData as { currency?: string } | undefined)?.currency;
  const securityCurrency = security.moneda;
  const currency: "USD" | "ARS" = isBond
    ? "ARS"
    : (yahooResolvedCurrency === "USD" || yahooResolvedCurrency === "ARS")
      ? yahooResolvedCurrency
      : (securityCurrency === "USD" || securityCurrency === "ARS")
        ? securityCurrency
        : resolvedCategory === "stock" ? "ARS" : "USD";

  const handleSaveNotes = () => {
    if (!resolvedId) return;
    updateMutation.mutate(
      { id: resolvedId, data: { notes: notesValue.trim() || undefined } },
      { onSuccess: () => setEditingNotes(false) }
    );
  };

  const handleToggleWatchlist = () => {
    if (isInWatchlist && resolvedId) {
      removeMutation.mutate(resolvedId);
    } else {
      addMutation.mutate({
        ticker: security.simbolo,
        name: security.descripcion,
        category: resolvedCategory,
      });
    }
  };

  const handleDelete = () => {
    if (resolvedId) {
      removeMutation.mutate(resolvedId, { onSuccess: onClose });
    }
  };

  // ── Chart helpers ──────────────────────────────────────────────────
  const formatAxisDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (selectedPeriod === "5Y") {
      return `${date.toLocaleString("default", { month: "short" })} '${String(date.getFullYear()).slice(2)}`;
    }
    if (selectedPeriod === "1Y") {
      return `${date.toLocaleString("default", { month: "short" })} '${String(date.getFullYear()).slice(2)}`;
    }
    return `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`;
  };

  const formatXLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (selectedPeriod === "5Y") return String(date.getFullYear());
    if (selectedPeriod === "1Y") return `${date.toLocaleString("default", { month: "short" })} '${String(date.getFullYear()).slice(2)}`;
    return `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`;
  };

  const formatAxisPrice = (price: number) => {
    if (price >= 1000) return `${(price / 1000).toFixed(1)}k`;
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(4);
  };

  const renderChart = () => {
    if (history.length < 2) return null;

    const prices = history.map((h) => h.close);
    const dates = history.map((h) => h.date);
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
    const isPos = prices[prices.length - 1] >= prices[0];
    const color = isPos ? "#34d399" : "#f87171";

    const safeIdx = hoveredIndex !== null && hoveredIndex < chartPoints.length ? hoveredIndex : null;
    const hovered = safeIdx !== null ? chartPoints[safeIdx] : null;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const xRatio = (e.clientX - rect.left) / rect.width;
      const idx = Math.round(xRatio * (chartPoints.length - 1));
      setHoveredIndex(Math.max(0, Math.min(idx, chartPoints.length - 1)));
    };

    const yLabelCount = 5;
    const yLabels = Array.from({ length: yLabelCount }, (_, i) => ({
      price: chartMax - (i / (yLabelCount - 1)) * chartRange,
    }));

    // ── Year boundary markers (for 5Y) ──────────────────────────────
    const yearBoundaries: { x: number; year: number }[] = [];
    if (selectedPeriod === "5Y") {
      let lastYear = -1;
      for (let i = 0; i < dates.length; i++) {
        const y = new Date(dates[i]).getFullYear();
        if (y !== lastYear) {
          lastYear = y;
          yearBoundaries.push({
            x: (i / (dates.length - 1)) * svgW,
            year: y,
          });
        }
      }
    }

    // ── X-axis labels ────────────────────────────────────────────────
    let xLabels: { label: string; pct: number }[];

    if (selectedPeriod === "5Y") {
      // Use year boundaries as labels, skip first if too close to edge
      xLabels = yearBoundaries
        .filter((b) => b.x > svgW * 0.02 && b.x < svgW * 0.98)
        .map((b) => ({
          label: String(b.year),
          pct: (b.x / svgW) * 100,
        }));
    } else {
      xLabels = Array.from({ length: 5 }, (_, i) => {
        const idx = Math.round((i / 4) * (dates.length - 1));
        return {
          label: dates[idx] ? formatXLabel(dates[idx]) : "",
          pct: (i / 4) * 100,
        };
      });
    }

    return (
      <div className="space-y-1.5">
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
            <span className="text-xs text-zinc-500">Hover para ver detalle</span>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex flex-col justify-between text-[10px] font-mono text-zinc-500 w-14 text-right shrink-0 py-0.5">
            {yLabels.map((label, i) => (
              <span key={i}>{formatAxisPrice(label.price)}</span>
            ))}
          </div>
          <div
            className="flex-1 relative cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-48" preserveAspectRatio="none">
              <defs>
                <linearGradient id="detail-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                  <stop offset="80%" stopColor={color} stopOpacity="0.05" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Horizontal grid lines */}
              {yLabels.map((_, i) => (
                <line key={i} x1="0" y1={(i / (yLabelCount - 1)) * svgH} x2={svgW} y2={(i / (yLabelCount - 1)) * svgH} stroke="#27272a" strokeWidth="0.5" />
              ))}
              {/* Vertical year boundary lines (5Y only) */}
              {yearBoundaries.map((b) => (
                <line key={b.year} x1={b.x} y1="0" x2={b.x} y2={svgH} stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="4 3" />
              ))}
              <polygon points={areaPoints} fill="url(#detail-fill)" />
              <polyline fill="none" stroke={color} strokeWidth="2" points={linePoints} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            {hovered && (
              <>
                <div className="absolute top-0 bottom-0 w-px pointer-events-none" style={{ left: `${(hovered.x / svgW) * 100}%`, backgroundColor: "#52525b" }} />
                <div className="absolute left-0 right-0 h-px pointer-events-none" style={{ top: `${(hovered.y / svgH) * 100}%`, backgroundColor: "#52525b" }} />
                <div
                  className="absolute w-3 h-3 rounded-full border-2 border-zinc-900 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${(hovered.x / svgW) * 100}%`, top: `${(hovered.y / svgH) * 100}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
                />
              </>
            )}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="relative text-[10px] font-mono text-zinc-500 ml-16 h-4">
          {xLabels.map((item, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2"
              style={{ left: `${item.pct}%` }}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 modal-backdrop" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${security.simbolo} detail`}
        className="relative z-10 w-full max-w-lg mx-2 sm:mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto modal-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleToggleWatchlist}
              disabled={addMutation.isPending || removeMutation.isPending}
              className={cn(
                "p-1 rounded-lg transition-colors shrink-0",
                isInWatchlist ? "text-yellow-400" : "text-zinc-500 hover:text-yellow-400"
              )}
              title={isInWatchlist ? "Quitar de favoritos" : "Agregar a favoritos"}
            >
              <Star className={cn("h-5 w-5", isInWatchlist && "fill-yellow-400")} />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-zinc-100 font-mono">{security.simbolo}</h2>
              <p className="text-sm text-zinc-500 truncate">{security.descripcion}</p>
            </div>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: `${CATEGORY_COLORS[resolvedCategory]}20`,
                color: CATEGORY_COLORS[resolvedCategory],
              }}
            >
              {CATEGORY_LABELS[resolvedCategory]}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors shrink-0">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Price + Period Change */}
          {currentPrice !== null && currentPrice > 0 && (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Último cierre</p>
                <p className="text-2xl font-bold font-mono text-zinc-100">
                  {formatCurrency(currentPrice, currency)}
                </p>
              </div>
              {periodChange !== null && (
                <div
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-mono font-semibold",
                    periodChange >= 0 ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400"
                  )}
                >
                  {periodChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {periodChange >= 0 ? "+" : ""}{periodChange.toFixed(2)}%
                  <span className="text-xs opacity-60 ml-0.5">{selectedPeriod}</span>
                </div>
              )}
            </div>
          )}

          {/* Period Tabs */}
          <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1">
            {TIME_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => { setSelectedPeriod(p); setHoveredIndex(null); }}
                className={cn(
                  "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  selectedPeriod === p ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-zinc-800/50 rounded-lg p-3 min-h-[280px]">
            {chartLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
                <span className="ml-2 text-sm text-zinc-500">Cargando gráfico...</span>
              </div>
            ) : chartError ? (
              <div className="flex items-center justify-center h-48 text-amber-400">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span className="text-sm">No se pudo cargar el historial</span>
              </div>
            ) : history.length >= 2 ? (
              <div>
                {renderChart()}
                <p className="text-[10px] text-zinc-500 mt-2">{history.length} puntos · Yahoo Finance</p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-zinc-500">
                <span className="text-sm">Sin datos históricos para este período</span>
              </div>
            )}
          </div>

          {/* Company Fundamentals (stocks/CEDEARs only) */}
          {(resolvedCategory === "cedear" || resolvedCategory === "stock") && (
            <ErrorBoundary>
              <CompanyFundamentals symbol={security.simbolo} />
            </ErrorBoundary>
          )}

          {/* Bond/ON detail panel */}
          <BondDetailPanel
            ticker={security.simbolo}
            currentPrice={currentPrice ?? security.ultimoPrecio}
            priceMap={priceMap}
          />

          {/* Notes (only when in watchlist) */}
          {isInWatchlist && (
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Notas</p>
                {!editingNotes && (
                  <button onClick={() => setEditingNotes(true)} className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors" aria-label="Edit notes">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    maxLength={500}
                    autoFocus
                    rows={3}
                    onKeyDown={(e) => { if (e.key === "Escape") { setNotesValue(resolvedNotes || ""); setEditingNotes(false); } }}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 resize-none"
                    placeholder="Escribí tus notas sobre este instrumento..."
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">{notesValue.length}/500</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setNotesValue(resolvedNotes || ""); setEditingNotes(false); }} className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-md transition-colors">
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded-md transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {updateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        <Check className="h-3 w-3" />
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className={cn("text-sm", resolvedNotes ? "text-zinc-300" : "text-zinc-500 italic")}>
                  {resolvedNotes || "Sin notas — hacé clic en el lápiz para agregar."}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800 px-4 py-3 flex items-center justify-between">
          {isInWatchlist ? (
            <button
              onClick={handleDelete}
              disabled={removeMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {removeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Eliminar de favoritos
            </button>
          ) : (
            <button
              onClick={handleToggleWatchlist}
              disabled={addMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10 border border-yellow-500/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
              Agregar a favoritos
            </button>
          )}
          <p className="text-[10px] text-zinc-500">Yahoo Finance · Clic afuera para cerrar</p>
        </div>
      </div>
    </div>
  );
}
