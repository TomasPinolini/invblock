"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  AVNewsFeed,
  AVCompanyOverview,
  AVTopMoversResponse,
  AVBudgetStatus,
} from "@/services/alphavantage";

// ── Shared types ────────────────────────────────────────────────────────

interface AVResponse<T> {
  data: T;
  budget: AVBudgetStatus;
  error?: string;
}

// ── News Sentiment ──────────────────────────────────────────────────────

async function fetchNewsSentiment(
  tickers?: string[]
): Promise<AVResponse<AVNewsFeed[]>> {
  const params = new URLSearchParams();
  if (tickers?.length) params.set("tickers", tickers.join(","));

  const res = await fetch(`/api/alphavantage/news?${params}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to fetch news");
  return json;
}

export function useNewsSentiment(tickers?: string[]) {
  return useQuery({
    queryKey: ["av-news", tickers?.sort().join(",") || "general"],
    queryFn: () => fetchNewsSentiment(tickers),
    staleTime: 2 * 60 * 60 * 1000, // 2 hours (matches server cache)
    refetchOnWindowFocus: false,
  });
}

// ── Company Overview ────────────────────────────────────────────────────

async function fetchCompanyOverview(
  symbol: string
): Promise<AVResponse<AVCompanyOverview>> {
  const res = await fetch(`/api/alphavantage/company?symbol=${symbol}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to fetch company data");
  return json;
}

export function useCompanyOverview(symbol: string | undefined) {
  return useQuery({
    queryKey: ["av-company", symbol],
    queryFn: () => fetchCompanyOverview(symbol!),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours (matches server cache)
    refetchOnWindowFocus: false,
  });
}

// ── Top Movers ──────────────────────────────────────────────────────────

async function fetchTopMovers(): Promise<AVResponse<AVTopMoversResponse>> {
  const res = await fetch("/api/alphavantage/movers");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to fetch movers");
  return json;
}

export function useTopMovers() {
  return useQuery({
    queryKey: ["av-movers"],
    queryFn: fetchTopMovers,
    staleTime: 30 * 60 * 1000, // 30 minutes (matches server cache)
    refetchOnWindowFocus: false,
  });
}
