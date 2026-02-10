"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
} from "lucide-react";
import { useTradeEvaluator } from "@/hooks/useTradeEvaluator";
import type {
  PortfolioAsset as TradePortfolioAsset,
  TradeEvaluation,
  TradeVerdict,
  ConfidenceLevel,
} from "@/hooks/useTradeEvaluator";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { cn } from "@/lib/utils";
import type { PortfolioRow } from "@/components/portfolio/columns";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapRowsToTradeAssets(rows: PortfolioRow[]): TradePortfolioAsset[] {
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

const verdictConfig: Record<
  TradeVerdict,
  { label: string; bg: string; icon: typeof TrendingUp }
> = {
  buy: {
    label: "BUY",
    bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    icon: TrendingUp,
  },
  hold: {
    label: "HOLD",
    bg: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: Minus,
  },
  avoid: {
    label: "AVOID",
    bg: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: TrendingDown,
  },
};

const confidenceStyles: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

function getScoreColor(score: number) {
  if (score >= 8) return "text-emerald-400";
  if (score >= 5) return "text-amber-400";
  return "text-red-400";
}

function getScoreBarColor(score: number) {
  if (score >= 8) return "bg-emerald-400";
  if (score >= 5) return "bg-amber-400";
  return "bg-red-400";
}

// ── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className={cn("text-2xl font-bold font-mono", getScoreColor(score))}>
        {score}
      </span>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              getScoreBarColor(score)
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] text-zinc-600">1</span>
          <span className="text-[10px] text-zinc-600">10</span>
        </div>
      </div>
    </div>
  );
}

// ── Result Display ───────────────────────────────────────────────────────────

function EvaluationResult({
  result,
  onReset,
}: {
  result: TradeEvaluation;
  onReset: () => void;
}) {
  const verdict = verdictConfig[result.verdict];
  const VerdictIcon = verdict.icon;

  return (
    <div className="space-y-5">
      {/* Ticker + Verdict Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-mono font-bold text-zinc-100">
            {result.ticker}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border font-semibold",
              verdict.bg
            )}
          >
            <VerdictIcon className="h-4 w-4" />
            {verdict.label}
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

      {/* Score Bar */}
      <ScoreBar score={result.score} />

      {/* Summary */}
      <p className="text-sm text-zinc-300 leading-relaxed">
        {result.summary}
      </p>

      {/* Pros & Cons */}
      {(result.pros.length > 0 || result.cons.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pros */}
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4">
            <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2">
              Pros
            </h4>
            {result.pros.length > 0 ? (
              <ul className="space-y-2">
                {result.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-zinc-300">{pro}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-600">No pros identified</p>
            )}
          </div>

          {/* Cons */}
          <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-4">
            <h4 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">
              Cons
            </h4>
            {result.cons.length > 0 ? (
              <ul className="space-y-2">
                {result.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-zinc-300">{con}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-600">No cons identified</p>
            )}
          </div>
        </div>
      )}

      {/* Portfolio Impact */}
      {result.portfolioImpact && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
            Portfolio Impact
          </h4>
          <p className="text-sm text-zinc-300">{result.portfolioImpact}</p>
        </div>
      )}

      {/* Alternative Consideration */}
      {result.alternativeConsideration && (
        <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-1">
                Alternative to Consider
              </h4>
              <p className="text-sm text-zinc-300">
                {result.alternativeConsideration}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Exposure */}
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        {result.currentExposure.alreadyHeld ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Already held &middot;{" "}
            <span className="font-mono text-zinc-300">
              {result.currentExposure.currentAllocation.toFixed(1)}%
            </span>{" "}
            allocation
            {result.currentExposure.category && (
              <>
                {" "}
                &middot; {result.currentExposure.category}
              </>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            Not currently in portfolio
          </span>
        )}
      </div>

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700
                   text-zinc-300 text-sm font-medium transition-colors inline-flex
                   items-center justify-center gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        Evaluate Another
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function TradeEvaluatorCard() {
  const { data: portfolioRows, isLoading: portfolioLoading } = usePortfolioData();
  const { mutate, data: result, isPending, error, reset } = useTradeEvaluator();

  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTicker = ticker.trim().toUpperCase();
    if (!trimmedTicker) return;

    const portfolio = mapRowsToTradeAssets(portfolioRows);
    const qty = quantity ? parseFloat(quantity) : undefined;

    mutate({
      ticker: trimmedTicker,
      quantity: qty && qty > 0 ? qty : undefined,
      portfolio,
    });
  };

  const handleReset = () => {
    reset();
    setTicker("");
    setQuantity("");
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold">Trade Evaluator</h2>
      </div>

      {/* Show form if no result yet and not loading */}
      {!result && !isPending && (
        <>
          <p className="text-sm text-zinc-500 mb-4">
            Enter a ticker to get an AI-powered evaluation of whether a trade
            makes sense given your current portfolio composition.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              {/* Ticker input */}
              <div className="flex-1">
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="Enter ticker e.g. GGAL"
                  className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/50
                             px-3 text-sm font-mono text-zinc-200 placeholder:text-zinc-600
                             focus:outline-none focus:ring-1 focus:ring-blue-500/50
                             uppercase"
                  aria-label="Ticker symbol"
                />
              </div>
              {/* Quantity input (optional) */}
              <div className="w-28">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Qty"
                  min="0"
                  step="any"
                  className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/50
                             px-3 text-sm font-mono text-zinc-200 placeholder:text-zinc-600
                             focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  aria-label="Quantity (optional)"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                {error instanceof Error ? error.message : "Evaluation failed"}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!ticker.trim() || portfolioLoading}
              className="w-full h-10 rounded-lg bg-amber-600 hover:bg-amber-500
                         disabled:opacity-50 text-white text-sm font-medium
                         transition-colors inline-flex items-center justify-center gap-2"
            >
              <Search className="h-4 w-4" />
              Evaluate
            </button>

            {portfolioRows.length > 0 && (
              <p className="text-xs text-zinc-600 text-center">
                <CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-500" />
                Will analyze against {portfolioRows.length} portfolio positions
              </p>
            )}
          </form>
        </>
      )}

      {/* Loading state */}
      {isPending && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-300">
              Evaluating{" "}
              <span className="font-mono text-amber-400">
                {ticker.trim().toUpperCase()}
              </span>
              ...
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Analyzing trade against your portfolio
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !isPending && (
        <EvaluationResult result={result} onReset={handleReset} />
      )}
    </div>
  );
}
