"use client";

import { useState } from "react";
import {
  LogOut,
  Loader2,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Clock,
  Scissors,
  ShieldCheck,
  DoorOpen,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useExitAdvisor } from "@/hooks/useExitAdvisor";
import type {
  PortfolioAsset as ExitPortfolioAsset,
  ExitAnalysis,
  ExitRecommendation,
  ConfidenceLevel,
} from "@/hooks/useExitAdvisor";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { cn } from "@/lib/utils";
import type { PortfolioRow } from "@/components/portfolio/columns";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapRowsToAssets(rows: PortfolioRow[]): ExitPortfolioAsset[] {
  return rows.map((row) => ({
    ticker: row.ticker,
    name: row.name,
    category: row.category,
    currency: row.currency,
    quantity: row.quantity,
    averagePrice: row.averagePrice,
    currentPrice: row.currentPrice,
    currentValue: row.currentValue,
    pnl: row.pnl,
    pnlPercent: row.pnlPercent,
    allocation: row.allocation,
  }));
}

const recommendationConfig: Record<
  ExitRecommendation,
  { label: string; bg: string; icon: typeof ShieldCheck }
> = {
  hold: {
    label: "HOLD",
    bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    icon: ShieldCheck,
  },
  trim: {
    label: "TRIM",
    bg: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: Scissors,
  },
  exit: {
    label: "EXIT",
    bg: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: DoorOpen,
  },
};

const confidenceStyles: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

// ── Result Display ───────────────────────────────────────────────────────────

function ExitResult({
  result,
  onReset,
}: {
  result: ExitAnalysis;
  onReset: () => void;
}) {
  const rec = recommendationConfig[result.recommendation];
  const RecIcon = rec.icon;
  const pnlColor = result.metrics.unrealizedPnlPercent >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="space-y-5">
      {/* Ticker + Recommendation Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-mono font-bold text-zinc-100">
            {result.ticker}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border font-semibold",
              rec.bg
            )}
          >
            <RecIcon className="h-4 w-4" />
            {rec.label}
          </span>
        </div>
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full border font-medium leading-none",
            confidenceStyles[result.confidence]
          )}
        >
          {result.confidence} confidence
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase">Unrealized P&L</p>
          <p className={cn("text-sm font-mono font-semibold", pnlColor)}>
            {result.metrics.unrealizedPnlPercent >= 0 ? "+" : ""}
            {result.metrics.unrealizedPnlPercent.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase">Weight</p>
          <p className="text-sm font-mono font-semibold text-zinc-200">
            {result.metrics.positionWeight.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase">Held</p>
          <p className="text-sm font-mono font-semibold text-zinc-200">
            {result.metrics.holdingPeriodDays !== null
              ? `${result.metrics.holdingPeriodDays}d`
              : "N/A"}
          </p>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-zinc-300 leading-relaxed">{result.summary}</p>

      {/* Holding Analysis */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
        <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
          Position Analysis
        </h4>
        <p className="text-sm text-zinc-300">{result.holdingAnalysis}</p>
      </div>

      {/* Target Action */}
      <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-1">
              Recommended Action
            </h4>
            <p className="text-sm text-zinc-300">{result.targetAction}</p>
          </div>
        </div>
      </div>

      {/* Timing Factors & Risks */}
      {(result.timingFactors.length > 0 || result.risks.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {result.timingFactors.length > 0 && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4">
              <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                Timing Factors
              </h4>
              <ul className="space-y-2">
                {result.timingFactors.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-zinc-300">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.risks.length > 0 && (
            <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
              <h4 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">
                Risks
              </h4>
              <ul className="space-y-2">
                {result.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-zinc-300">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tax Considerations */}
      {result.taxConsiderations && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4">
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
            Consideraciones Impositivas
          </h4>
          <p className="text-xs text-zinc-400">{result.taxConsiderations}</p>
        </div>
      )}

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700
                   text-zinc-300 text-sm font-medium transition-colors inline-flex
                   items-center justify-center gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        Analizar Otra Posicion
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ExitAdvisorCard() {
  const { data: portfolioRows, isLoading: portfolioLoading } = usePortfolioData();
  const { mutate, data: result, isPending, error, reset } = useExitAdvisor();

  const [ticker, setTicker] = useState("");
  const [targetReturn, setTargetReturn] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTicker = ticker.trim().toUpperCase();
    if (!trimmedTicker) return;

    const portfolio = mapRowsToAssets(portfolioRows);
    const target = targetReturn ? parseFloat(targetReturn) : undefined;

    mutate({
      ticker: trimmedTicker,
      targetReturn: target && isFinite(target) ? target : undefined,
      portfolio,
    });
  };

  const handleReset = () => {
    reset();
    setTicker("");
    setTargetReturn("");
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <LogOut className="h-5 w-5 text-indigo-400" />
        <h2 className="text-lg font-semibold">Advisor de Salida</h2>
      </div>

      {/* Show form if no result yet and not loading */}
      {!result && !isPending && (
        <>
          <p className="text-sm text-zinc-500 mb-4">
            Ingresa un ticker de tu portfolio para obtener recomendaciones con IA
            sobre si mantener, reducir o salir de la posicion.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="Ticker ej. GGAL"
                  className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/50
                             px-3 text-sm font-mono text-zinc-200 placeholder:text-zinc-500
                             focus:outline-none focus:ring-1 focus:ring-indigo-500/50
                             uppercase"
                  aria-label="Ticker symbol"
                />
              </div>
              <div className="w-28">
                <input
                  type="number"
                  value={targetReturn}
                  onChange={(e) => setTargetReturn(e.target.value)}
                  placeholder="Objetivo %"
                  step="any"
                  className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/50
                             px-3 text-sm font-mono text-zinc-200 placeholder:text-zinc-500
                             focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  aria-label="Target return percentage (optional)"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                {error instanceof Error ? error.message : "Error en el analisis"}
              </div>
            )}

            <button
              type="submit"
              disabled={!ticker.trim() || portfolioLoading}
              className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500
                         disabled:opacity-50 text-white text-sm font-medium
                         transition-colors inline-flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Analizar Salida
            </button>

            {portfolioRows.length > 0 && (
              <p className="text-xs text-zinc-500 text-center">
                <CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-500" />
                Se analizara contra {portfolioRows.length} posiciones del portfolio
              </p>
            )}
          </form>
        </>
      )}

      {/* Loading state */}
      {isPending && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-300">
              Analizando{" "}
              <span className="font-mono text-indigo-400">
                {ticker.trim().toUpperCase()}
              </span>
              ...
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Evaluando estrategia de salida
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !isPending && (
        <ExitResult result={result} onReset={handleReset} />
      )}
    </div>
  );
}
