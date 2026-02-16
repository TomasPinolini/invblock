"use client";

import { useMutation } from "@tanstack/react-query";

// ── Input Types ───────────────────────────────────────────────────────────────

export interface PortfolioAsset {
  ticker: string;
  name?: string;
  category?: string;
  currency?: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  pnl?: number;
  pnlPercent?: number;
  allocation?: number;
}

export interface CorrelationInput {
  portfolio: PortfolioAsset[];
}

// ── Response Types ────────────────────────────────────────────────────────────

export interface GroupAllocation {
  name: string;
  tickers: string[];
  totalValue: number;
  allocation: number;
  isConcentrated: boolean;
}

export interface CorrelationAnalysis {
  concentrationScore: number;
  rating: "Well Diversified" | "Moderate Risk" | "Concentrated" | "Highly Concentrated";
  hiddenRisks: string[];
  decorrelationSuggestions: string[];
  summary: string;
  groups: {
    bySector: GroupAllocation[];
    byCountry: GroupAllocation[];
    byCorrelationGroup: GroupAllocation[];
  };
}

// ── Fetch Function ────────────────────────────────────────────────────────────

async function analyzeCorrelation(input: CorrelationInput): Promise<CorrelationAnalysis> {
  const res = await fetch("/api/insights/correlation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Correlation analysis failed");
  }

  return data;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCorrelationAnalysis() {
  return useMutation({
    mutationFn: analyzeCorrelation,
  });
}
