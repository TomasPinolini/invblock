"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileText,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Lightbulb,
  X,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useIOLPortfolio } from "@/hooks/useIOLPortfolio";
import { useBinancePortfolio } from "@/hooks/useBinancePortfolio";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import PortfolioAdvisorCard from "@/components/portfolio/PortfolioAdvisorCard";
import TradeEvaluatorCard from "@/components/portfolio/TradeEvaluatorCard";
import dynamic from "next/dynamic";

const NewsSentiment = dynamic(
  () => import("@/components/market/NewsSentiment")
);

type Recommendation = {
  ticker: string;
  reason: string;
  confidence?: "high" | "medium" | "low";
};

type Analysis = {
  summary: string[];
  mentionedAssets: string[];
  recommendations: {
    buy: Recommendation[];
    sell: Recommendation[];
    hold: Recommendation[];
  };
  risks: string[];
  sentiment: "Bullish" | "Neutral" | "Bearish";
  sentimentReason: string;
};

const confidenceBadgeStyles = {
  high: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
} as const;

function ConfidenceBadge({ confidence }: { confidence?: "high" | "medium" | "low" }) {
  if (!confidence) return null;
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full border font-medium leading-none",
        confidenceBadgeStyles[confidence],
      )}
    >
      {confidence}
    </span>
  );
}

export default function InsightsPage() {
  const router = useRouter();
  const { data: iolPortfolio } = useIOLPortfolio();
  const { data: binancePortfolio } = useBinancePortfolio();

  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Merge portfolio data
  const portfolioData = [
    ...(iolPortfolio?.assets ?? []),
    ...(binancePortfolio?.assets ?? []),
  ].map((asset) => ({
    ticker: asset.ticker,
    name: asset.name,
    category: asset.category,
    quantity: asset.quantity,
    currentValue: asset.currentValue,
    pnl: asset.pnl,
    pnlPercent: asset.pnlPercent,
  }));

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile?.type === "application/pdf") {
      setFile(droppedFile);
      setError(null);
      setAnalysis(null);
    } else {
      setError("Please upload a PDF file");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.type === "application/pdf") {
      setFile(selectedFile);
      setError(null);
      setAnalysis(null);
    } else if (selectedFile) {
      setError("Please upload a PDF file");
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("portfolio", JSON.stringify(portfolioData));

      const response = await fetch("/api/insights/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setAnalysis(null);
    setError(null);
  };

  const SentimentBadge = ({ sentiment }: { sentiment: string }) => {
    const config = {
      Bullish: { bg: "bg-emerald-500/20", text: "text-emerald-400", icon: TrendingUp },
      Bearish: { bg: "bg-red-500/20", text: "text-red-400", icon: TrendingDown },
      Neutral: { bg: "bg-zinc-500/20", text: "text-zinc-400", icon: Minus },
    }[sentiment] || { bg: "bg-zinc-500/20", text: "text-zinc-400", icon: Minus };

    const Icon = config.icon;

    return (
      <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium", config.bg, config.text)}>
        <Icon className="h-4 w-4" />
        {sentiment}
      </span>
    );
  };

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Market Insights</h1>
            <p className="text-sm text-zinc-500">
              Upload PPI reports for AI-powered analysis
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            Upload Market Report
          </h2>

          {!file ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center transition-colors",
                dragActive
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 hover:border-zinc-600"
              )}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-zinc-500" />
              <p className="text-zinc-400 mb-2">
                Drag and drop your PDF here, or
              </p>
              <label className="inline-block">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium cursor-pointer transition-colors">
                  Browse Files
                </span>
              </label>
              <p className="text-xs text-zinc-600 mt-4">
                Supported: PPI Daily Mercados, Cierre Mercados, Perspectivas, Noticias del Domingo
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-zinc-200">{file.name}</p>
                  <p className="text-xs text-zinc-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearFile}
                  className="p-2 rounded-lg hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {file && !analysis && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="mt-4 w-full h-12 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors inline-flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing report...
                </>
              ) : (
                <>
                  <Lightbulb className="h-5 w-5" />
                  Analyze with AI
                </>
              )}
            </button>
          )}

          {portfolioData.length > 0 && (
            <p className="text-xs text-zinc-500 mt-3">
              <CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-500" />
              Portfolio data will be included ({portfolioData.length} assets)
            </p>
          )}
        </div>

        {/* Market News & Sentiment */}
        <div className="mb-6">
          <ErrorBoundary>
            <NewsSentiment
              tickers={portfolioData
                .filter((a) => a.category === "cedear" || a.category === "stock")
                .map((a) => a.ticker)
                .slice(0, 5)}
            />
          </ErrorBoundary>
        </div>

        {/* Portfolio Intelligence Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Portfolio Intelligence</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <ErrorBoundary>
              <PortfolioAdvisorCard />
            </ErrorBoundary>
            <ErrorBoundary>
              <TradeEvaluatorCard />
            </ErrorBoundary>
          </div>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-6">
            {/* Sentiment */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Market Sentiment</h2>
                <SentimentBadge sentiment={analysis.sentiment} />
              </div>
              <p className="text-zinc-400">{analysis.sentimentReason}</p>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="text-lg font-semibold mb-4">Key Takeaways</h2>
              <ul className="space-y-2">
                {analysis.summary.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-zinc-300">
                    <span className="text-blue-400 mt-1">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Buy */}
              <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-5">
                <h3 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Buy Opportunities
                </h3>
                {analysis.recommendations.buy.length > 0 ? (
                  <ul className="space-y-3">
                    {analysis.recommendations.buy.map((rec, i) => (
                      <li key={i}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-emerald-300">{rec.ticker}</span>
                          <ConfidenceBadge confidence={rec.confidence} />
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{rec.reason}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-500">No buy recommendations</p>
                )}
              </div>

              {/* Sell */}
              <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-5">
                <h3 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Consider Selling
                </h3>
                {analysis.recommendations.sell.length > 0 ? (
                  <ul className="space-y-3">
                    {analysis.recommendations.sell.map((rec, i) => (
                      <li key={i}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-red-300">{rec.ticker}</span>
                          <ConfidenceBadge confidence={rec.confidence} />
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{rec.reason}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-500">No sell recommendations</p>
                )}
              </div>

              {/* Hold */}
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-5">
                <h3 className="font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                  <Minus className="h-4 w-4" />
                  Hold Positions
                </h3>
                {analysis.recommendations.hold.length > 0 ? (
                  <ul className="space-y-3">
                    {analysis.recommendations.hold.map((rec, i) => (
                      <li key={i}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-zinc-300">{rec.ticker}</span>
                          <ConfidenceBadge confidence={rec.confidence} />
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{rec.reason}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-500">No hold recommendations</p>
                )}
              </div>
            </div>

            {/* Risks */}
            {analysis.risks.length > 0 && (
              <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-6">
                <h2 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risks & Warnings
                </h2>
                <ul className="space-y-2">
                  {analysis.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-zinc-300">
                      <span className="text-amber-400 mt-1">•</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mentioned Assets */}
            {analysis.mentionedAssets.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h2 className="text-lg font-semibold mb-4">Assets Mentioned</h2>
                <div className="flex flex-wrap gap-2">
                  {analysis.mentionedAssets.map((asset, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-sm font-mono"
                    >
                      {asset}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Analyze Another */}
            <button
              onClick={clearFile}
              className="w-full h-12 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
            >
              Analyze Another Report
            </button>
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
