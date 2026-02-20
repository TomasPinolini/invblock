"use client";

import { ExternalLink, Newspaper, Loader2 } from "lucide-react";
import { useNewsSentiment } from "@/hooks/useAlphaVantage";
import { AVBudgetIndicator } from "./AVBudgetIndicator";
import { cn } from "@/lib/utils";
import type { AVNewsFeed } from "@/services/alphavantage";

const SENTIMENT_STYLES: Record<string, { bg: string; text: string }> = {
  Bullish: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  "Somewhat-Bullish": { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  Neutral: { bg: "bg-zinc-500/20", text: "text-zinc-400" },
  "Somewhat-Bearish": { bg: "bg-red-500/10", text: "text-red-500" },
  Bearish: { bg: "bg-red-500/20", text: "text-red-400" },
};

function SentimentBadge({ label }: { label: string }) {
  const style = SENTIMENT_STYLES[label] || SENTIMENT_STYLES.Neutral;
  return (
    <span
      className={cn(
        "text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
        style.bg,
        style.text
      )}
    >
      {label}
    </span>
  );
}

function formatTimeAgo(timeStr: string): string {
  // AV format: "20250214T153000"
  const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!match) return "";

  const date = new Date(
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
  );
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function NewsItem({ item }: { item: AVNewsFeed }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-200 font-medium line-clamp-2 group-hover:text-zinc-100">
            {item.title}
          </p>
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{item.summary}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-zinc-500">{item.source}</span>
            <span className="text-[10px] text-zinc-700">·</span>
            <span className="text-[10px] text-zinc-500">
              {formatTimeAgo(item.timePublished)}
            </span>
            <SentimentBadge label={item.overallSentimentLabel} />
          </div>
          {item.tickerSentiment.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.tickerSentiment.slice(0, 5).map((ts) => (
                <span
                  key={ts.ticker}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
                >
                  {ts.ticker}
                </span>
              ))}
            </div>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-400 shrink-0 mt-0.5" />
      </div>
    </a>
  );
}

export default function NewsSentiment({ tickers }: { tickers?: string[] }) {
  const { data: response, isLoading, error } = useNewsSentiment(tickers);

  const news = response?.data ?? [];
  const budget = response?.budget;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-blue-400" />
          Market News & Sentiment
        </h3>
        <AVBudgetIndicator budget={budget} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <span className="ml-2 text-sm text-zinc-500">Cargando noticias...</span>
        </div>
      ) : error || news.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-zinc-500">
            {budget?.isExhausted
              ? "Limite diario de API alcanzado. Se reinicia a medianoche UTC."
              : "No hay noticias disponibles"}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50 -mx-1">
          {news.map((item, i) => (
            <NewsItem key={`${item.url}-${i}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
