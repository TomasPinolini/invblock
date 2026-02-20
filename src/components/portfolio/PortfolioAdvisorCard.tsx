"use client";

import { useState } from "react";
import {
  Target,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  BarChart3,
  Coins,
  Hash,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Pause,
  Globe,
} from "lucide-react";
import { usePortfolioAdvisor } from "@/hooks/usePortfolioAdvisor";
import type {
  PortfolioAsset,
  AdvisorResponse,
  AdvisorRecommendation,
  HealthFinding,
  HealthSuggestion,
  RiskTolerance,
  InvestmentHorizon,
} from "@/hooks/usePortfolioAdvisor";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { cn } from "@/lib/utils";
import type { PortfolioRow } from "@/components/portfolio/columns";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapRowsToAssets(rows: PortfolioRow[]): PortfolioAsset[] {
  return rows.map((row) => ({
    ticker: row.ticker,
    name: row.name,
    category: row.category,
    currency: row.currency,
    quantity: row.quantity,
    currentValue: row.currentValue,
    pnl: row.pnl,
    pnlPercent: row.pnlPercent,
  }));
}

function getScoreColor(score: number) {
  if (score >= 80) return { ring: "text-emerald-400", bg: "stroke-emerald-400", track: "stroke-emerald-900/30" };
  if (score >= 60) return { ring: "text-blue-400", bg: "stroke-blue-400", track: "stroke-blue-900/30" };
  if (score >= 40) return { ring: "text-amber-400", bg: "stroke-amber-400", track: "stroke-amber-900/30" };
  return { ring: "text-red-400", bg: "stroke-red-400", track: "stroke-red-900/30" };
}

function getRatingBadge(rating: AdvisorResponse["rating"]) {
  const styles = {
    Excellent: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    Good: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Fair: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    Poor: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return styles[rating];
}

function getPriorityBadge(priority: HealthSuggestion["priority"]) {
  const styles = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };
  return styles[priority];
}

const findingIcons = {
  strength: { icon: CheckCircle2, color: "text-emerald-400" },
  warning: { icon: AlertTriangle, color: "text-amber-400" },
  critical: { icon: XCircle, color: "text-red-400" },
} as const;

const actionConfig = {
  buy: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "BUY" },
  sell: { icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "SELL" },
  rebalance: { icon: ArrowRightLeft, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "REBALANCE" },
  hold: { icon: Pause, color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20", label: "HOLD" },
} as const;

const confidenceBadgeStyles = {
  high: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
} as const;

// ── Score Circle (SVG) ──────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = getScoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="10"
          className={colors.track}
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={cn(colors.bg, "transition-all duration-1000 ease-out")}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-bold font-mono", colors.ring)}>
          {score}
        </span>
        <span className="text-xs text-zinc-500 uppercase tracking-wide">
          / 100
        </span>
      </div>
    </div>
  );
}

// ── Finding Item ─────────────────────────────────────────────────────────────

function FindingItem({ finding }: { finding: HealthFinding }) {
  const { icon: Icon, color } = findingIcons[finding.type];
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", color)} />
      <div>
        <p className="text-sm font-medium text-zinc-200">{finding.title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{finding.description}</p>
      </div>
    </div>
  );
}

// ── Suggestion Item ──────────────────────────────────────────────────────────

function SuggestionItem({
  suggestion,
  index,
}: {
  suggestion: HealthSuggestion;
  index: number;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-xs font-mono text-zinc-600 mt-0.5 flex-shrink-0 w-5 text-right">
        {index + 1}.
      </span>
      <div className="flex-1 flex items-start gap-2">
        <p className="text-sm text-zinc-300 flex-1">{suggestion.action}</p>
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full border font-medium leading-none flex-shrink-0",
            getPriorityBadge(suggestion.priority)
          )}
        >
          {suggestion.priority}
        </span>
      </div>
    </div>
  );
}

// ── Recommendation Item ──────────────────────────────────────────────────────

function RecommendationItem({ rec }: { rec: AdvisorRecommendation }) {
  const config = actionConfig[rec.action];
  const Icon = config.icon;

  return (
    <div className={cn("rounded-lg border p-3", config.bg)}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", config.color)} />
          <span className={cn("text-xs font-bold uppercase tracking-wider", config.color)}>
            {config.label}
          </span>
          <span className="font-mono text-sm font-semibold text-zinc-200">
            {rec.ticker}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full border font-medium leading-none",
              confidenceBadgeStyles[rec.confidence]
            )}
          >
            {rec.confidence}
          </span>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full border font-medium leading-none",
              getPriorityBadge(rec.priority)
            )}
          >
            {rec.priority}
          </span>
        </div>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">{rec.reason}</p>
    </div>
  );
}

// ── Profile Chips ────────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500 w-14 flex-shrink-0">{label}</span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border font-medium transition-colors",
              value === opt.value
                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                : "bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-600"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const riskOptions: { value: RiskTolerance; label: string }[] = [
  { value: "conservative", label: "Conservador" },
  { value: "moderate", label: "Moderado" },
  { value: "aggressive", label: "Agresivo" },
];

const horizonOptions: { value: InvestmentHorizon; label: string }[] = [
  { value: "short", label: "Corto" },
  { value: "medium", label: "Medio" },
  { value: "long", label: "Largo plazo" },
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function PortfolioAdvisorCard() {
  const { data: portfolioRows, isLoading: portfolioLoading } = usePortfolioData();
  const { mutate, data: result, isPending, error, reset } = usePortfolioAdvisor();
  const [hasRun, setHasRun] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("moderate");
  const [investmentHorizon, setInvestmentHorizon] = useState<InvestmentHorizon>("long");

  const handleAnalyze = () => {
    if (!portfolioRows.length) return;
    const assets = mapRowsToAssets(portfolioRows);
    mutate(
      { portfolio: assets, riskTolerance, investmentHorizon },
      { onSuccess: () => setHasRun(true) }
    );
  };

  const handleReanalyze = () => {
    reset();
    setHasRun(false);
    setTimeout(() => {
      if (!portfolioRows.length) return;
      const assets = mapRowsToAssets(portfolioRows);
      mutate(
        { portfolio: assets, riskTolerance, investmentHorizon },
        { onSuccess: () => setHasRun(true) }
      );
    }, 100);
  };

  // ── Initial state: show CTA with profile chips ────────────────────────────

  if (!hasRun && !isPending) {
    return (
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-400" />
            Advisor del Portfolio
          </h2>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          Obtene un analisis del portfolio con IA con recomendaciones de compra/venta/rebalanceo
          adaptadas a tu perfil de riesgo.
        </p>

        {/* Profile Chips */}
        <div className="space-y-2.5 mb-5 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800">
          <ChipGroup
            label="Riesgo"
            options={riskOptions}
            value={riskTolerance}
            onChange={setRiskTolerance}
          />
          <ChipGroup
            label="Horizonte"
            options={horizonOptions}
            value={investmentHorizon}
            onChange={setInvestmentHorizon}
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={portfolioLoading || portfolioRows.length === 0}
          className="btn-primary w-full"
        >
          <Target className="h-4 w-4" />
          Obtener Analisis del Advisor
        </button>
        {portfolioRows.length === 0 && !portfolioLoading && (
          <p className="text-xs text-zinc-600 mt-2 text-center">
            Conecta una cuenta de broker para analizar tu portfolio
          </p>
        )}
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isPending) {
    return (
      <div className="card-elevated p-6">
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-300">
              Analizando portfolio...
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Evaluando salud, tendencias y generando recomendaciones
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
        <div className="flex items-center gap-2 mb-3">
          <XCircle className="h-5 w-5 text-red-400" />
          <h2 className="text-lg font-semibold text-red-400">Error en el analisis</h2>
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          {error instanceof Error ? error.message : "Ocurrio un error inesperado"}
        </p>
        <button
          onClick={handleReanalyze}
          className="h-9 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200
                     text-sm font-medium transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────

  if (!result) return null;

  const { score, rating, findings, suggestions, recommendations, marketOutlook, strategy, metrics } = result;

  // Sort findings: critical first, then warnings, then strengths
  const sortedFindings = [...findings].sort((a, b) => {
    const order = { critical: 0, warning: 1, strength: 2 };
    return order[a.type] - order[b.type];
  });

  const criticalCount = findings.filter((f) => f.type === "critical").length;
  const warningCount = findings.filter((f) => f.type === "warning").length;
  const strengthCount = findings.filter((f) => f.type === "strength").length;

  return (
    <div className="card-elevated p-6 space-y-4">
      {/* Header — always visible, clickable to toggle */}
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        aria-expanded={isExpanded}
        aria-controls="advisor-details"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-400" />
            Advisor del Portfolio
          </h2>
          {/* Compact score badge when collapsed */}
          <span
            className={cn(
              "text-sm px-2.5 py-0.5 rounded-full border font-bold font-mono",
              getRatingBadge(rating)
            )}
          >
            {score}
          </span>
          {/* Finding counts as small badges */}
          {!isExpanded && (
            <div className="hidden sm:flex items-center gap-1.5 ml-1">
              {criticalCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                  {criticalCount} critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                  {warningCount} warning
                </span>
              )}
              {strengthCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                  {strengthCount} ok
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReanalyze();
            }}
            className="btn-ghost"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Re-analizar</span>
          </button>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-zinc-500 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </div>

      {/* Collapsible detail section */}
      <div
        id="advisor-details"
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isExpanded ? "max-h-[4000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-6 pt-2">
          {/* Profile Chips (editable for re-analyze) */}
          <div className="space-y-2 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800">
            <ChipGroup
              label="Riesgo"
              options={riskOptions}
              value={riskTolerance}
              onChange={setRiskTolerance}
            />
            <ChipGroup
              label="Horizonte"
              options={horizonOptions}
              value={investmentHorizon}
              onChange={setInvestmentHorizon}
            />
          </div>

          {/* Score + Rating + Strategy */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ScoreCircle score={score} />
            <div className="flex flex-col items-center sm:items-start gap-2">
              <span
                className={cn(
                  "text-sm px-3 py-1 rounded-full border font-medium",
                  getRatingBadge(rating)
                )}
              >
                {rating}
              </span>
              <p className="text-sm text-zinc-300 text-center sm:text-left max-w-sm">
                {strategy}
              </p>
            </div>
          </div>

          {/* Market Outlook */}
          {marketOutlook && (
            <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Perspectiva de Mercado
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {marketOutlook}
              </p>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                Recomendaciones
              </h3>
              <div className="space-y-2">
                {recommendations.map((rec, i) => (
                  <RecommendationItem key={i} rec={rec} />
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          {sortedFindings.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">
                Hallazgos
              </h3>
              <div className="divide-y divide-zinc-800/60">
                {sortedFindings.map((finding, i) => (
                  <FindingItem key={i} finding={finding} />
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">
                Sugerencias
              </h3>
              <div className="divide-y divide-zinc-800/60">
                {suggestions.map((suggestion, i) => (
                  <SuggestionItem key={i} suggestion={suggestion} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Metrics Footer */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-zinc-800/60">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>HHI:</span>
              <span className="font-mono text-zinc-400">
                {metrics.hhi.toFixed(0)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Hash className="h-3.5 w-3.5" />
              <span>Positions:</span>
              <span className="font-mono text-zinc-400">
                {metrics.positionCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Coins className="h-3.5 w-3.5" />
              <span>Currency:</span>
              <span className="font-mono text-zinc-400">
                {metrics.currencyExposure.usd.toFixed(0)}% USD
              </span>
              <span className="text-zinc-700">/</span>
              <span className="font-mono text-zinc-400">
                {metrics.currencyExposure.ars.toFixed(0)}% ARS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
