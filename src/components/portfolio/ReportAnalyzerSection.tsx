"use client";

import { useState, useCallback } from "react";
import {
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
} from "lucide-react";
import { useIOLPortfolio } from "@/hooks/useIOLPortfolio";
import { useBinancePortfolio } from "@/hooks/useBinancePortfolio";
import { usePPIPortfolio } from "@/hooks/usePPIPortfolio";
import { cn } from "@/lib/utils";

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

function SentimentBadge({ sentiment }: { sentiment: string }) {
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
}

export default function ReportAnalyzerSection() {
  const { data: iolPortfolio } = useIOLPortfolio();
  const { data: binancePortfolio } = useBinancePortfolio();
  const { data: ppiPortfolio } = usePPIPortfolio();

  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const portfolioData = [
    ...(iolPortfolio?.assets ?? []),
    ...(binancePortfolio?.assets ?? []),
    ...(ppiPortfolio?.assets ?? []),
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
      setError("Por favor subi un archivo PDF");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.type === "application/pdf") {
      setFile(selectedFile);
      setError(null);
      setAnalysis(null);
    } else if (selectedFile) {
      setError("Por favor subi un archivo PDF");
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

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
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
            Arrastra y solta tu PDF aca, o
          </p>
          <label className="inline-block">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <span className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium cursor-pointer transition-colors">
              Elegir Archivo
            </span>
          </label>
          <p className="text-xs text-zinc-600 mt-4">
            Soportado: PPI Daily Mercados, Cierre Mercados, Perspectivas, Noticias del Domingo
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
          <button
            onClick={clearFile}
            className="p-2 rounded-lg hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {file && !analysis && (
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full h-12 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors inline-flex items-center justify-center gap-2"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Analizando reporte...
            </>
          ) : (
            <>
              <Lightbulb className="h-5 w-5" />
              Analizar con IA
            </>
          )}
        </button>
      )}

      {portfolioData.length > 0 && !analysis && (
        <p className="text-xs text-zinc-500">
          <CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-500" />
          Se incluiran datos del portfolio ({portfolioData.length} activos)
        </p>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Sentiment */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Sentimiento de Mercado</h3>
              <SentimentBadge sentiment={analysis.sentiment} />
            </div>
            <p className="text-zinc-400">{analysis.sentimentReason}</p>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="text-lg font-semibold mb-4">Puntos Clave</h3>
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
                Oportunidades de Compra
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
                <p className="text-xs text-zinc-500">Sin recomendaciones de compra</p>
              )}
            </div>

            {/* Sell */}
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-5">
              <h3 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Considerar Venta
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
                <p className="text-xs text-zinc-500">Sin recomendaciones de venta</p>
              )}
            </div>

            {/* Hold */}
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-5">
              <h3 className="font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Minus className="h-4 w-4" />
                Mantener Posiciones
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
                <p className="text-xs text-zinc-500">Sin recomendaciones de mantener</p>
              )}
            </div>
          </div>

          {/* Risks */}
          {analysis.risks.length > 0 && (
            <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-6">
              <h3 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Riesgos y Advertencias
              </h3>
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
              <h3 className="text-lg font-semibold mb-4">Activos Mencionados</h3>
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
            Analizar Otro Reporte
          </button>
        </div>
      )}
    </div>
  );
}
