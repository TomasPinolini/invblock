"use client";

import {
  Network,
  Loader2,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import { useCorrelationAnalysis } from "@/hooks/useCorrelationAnalysis";
import type {
  PortfolioAsset as CorrPortfolioAsset,
  CorrelationAnalysis,
  GroupAllocation,
} from "@/hooks/useCorrelationAnalysis";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { cn } from "@/lib/utils";
import type { PortfolioRow } from "@/components/portfolio/columns";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapRowsToAssets(rows: PortfolioRow[]): CorrPortfolioAsset[] {
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

const ratingConfig: Record<
  CorrelationAnalysis["rating"],
  { color: string; bg: string }
> = {
  "Well Diversified": { color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30" },
  "Moderate Risk": { color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
  Concentrated: { color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30" },
  "Highly Concentrated": { color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
};

function getScoreColor(score: number) {
  if (score >= 70) return "bg-emerald-400";
  if (score >= 40) return "bg-amber-400";
  return "bg-red-400";
}

// ── Group Bar Chart ──────────────────────────────────────────────────────────

function GroupBars({
  title,
  groups,
}: {
  title: string;
  groups: GroupAllocation[];
}) {
  const top5 = groups.slice(0, 5);
  if (top5.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        {title}
      </h4>
      <div className="space-y-1.5">
        {top5.map((g) => (
          <div key={g.name} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span
                className={cn(
                  "text-zinc-300 truncate max-w-[60%]",
                  g.isConcentrated && "text-amber-400 font-medium"
                )}
              >
                {g.name}
                {g.isConcentrated && " !"}
              </span>
              <span className="font-mono text-zinc-400">
                {g.allocation.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  g.isConcentrated ? "bg-amber-400" : "bg-blue-400"
                )}
                style={{ width: `${Math.min(g.allocation, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Result Display ───────────────────────────────────────────────────────────

function CorrelationResult({
  result,
  onReset,
}: {
  result: CorrelationAnalysis;
  onReset: () => void;
}) {
  const rating = ratingConfig[result.rating];

  return (
    <div className="space-y-5">
      {/* Score + Rating */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold font-mono text-zinc-100">
            {result.concentrationScore}
          </span>
          <div className="flex-1">
            <div className="h-2 w-24 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  getScoreColor(result.concentrationScore)
                )}
                style={{ width: `${result.concentrationScore}%` }}
              />
            </div>
          </div>
        </div>
        <span
          className={cn(
            "text-xs px-2.5 py-1 rounded-full border font-medium",
            rating.bg,
            rating.color
          )}
        >
          {result.rating}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm text-zinc-300 leading-relaxed">{result.summary}</p>

      {/* Group Charts */}
      <div className="grid grid-cols-1 gap-4">
        <GroupBars title="By Sector" groups={result.groups.bySector} />
        <GroupBars title="By Country" groups={result.groups.byCountry} />
        <GroupBars
          title="Correlation Clusters"
          groups={result.groups.byCorrelationGroup}
        />
      </div>

      {/* Hidden Risks */}
      {result.hiddenRisks.length > 0 && (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
          <h4 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">
            Hidden Risks
          </h4>
          <ul className="space-y-2">
            {result.hiddenRisks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-zinc-300">{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {result.decorrelationSuggestions.length > 0 && (
        <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-4">
          <h4 className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-2">
            Diversification Ideas
          </h4>
          <ul className="space-y-2">
            {result.decorrelationSuggestions.map((sug, i) => (
              <li key={i} className="flex items-start gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-zinc-300">{sug}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reset */}
      <button
        onClick={onReset}
        className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700
                   text-zinc-300 text-sm font-medium transition-colors inline-flex
                   items-center justify-center gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        Re-analyze
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CorrelationAnalysisCard() {
  const { data: portfolioRows, isLoading: portfolioLoading } = usePortfolioData();
  const { mutate, data: result, isPending, error, reset } = useCorrelationAnalysis();

  const handleAnalyze = () => {
    const portfolio = mapRowsToAssets(portfolioRows);
    mutate({ portfolio });
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Network className="h-5 w-5 text-violet-400" />
        <h2 className="text-lg font-semibold">Correlation Analysis</h2>
      </div>

      {/* Initial state */}
      {!result && !isPending && (
        <>
          <p className="text-sm text-zinc-500 mb-4">
            Detect hidden concentration risks by analyzing sector, country, and
            correlation clusters in your portfolio.
          </p>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2 mb-3">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              {error instanceof Error ? error.message : "Analysis failed"}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={portfolioLoading || portfolioRows.length === 0}
            className="w-full h-10 rounded-lg bg-violet-600 hover:bg-violet-500
                       disabled:opacity-50 text-white text-sm font-medium
                       transition-colors inline-flex items-center justify-center gap-2"
          >
            <Network className="h-4 w-4" />
            Analyze Correlations
          </button>

          {portfolioRows.length > 0 && (
            <p className="text-xs text-zinc-600 text-center mt-3">
              <CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-500" />
              Will analyze {portfolioRows.length} positions
            </p>
          )}
        </>
      )}

      {/* Loading */}
      {isPending && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-300">
              Analyzing correlations...
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Detecting hidden concentration risks
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !isPending && (
        <CorrelationResult result={result} onReset={reset} />
      )}
    </div>
  );
}
