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

export interface ExitAdvisorInput {
  ticker: string;
  entryDate?: string;
  targetReturn?: number;
  portfolio: PortfolioAsset[];
}

// ── Response Types ────────────────────────────────────────────────────────────

export type ExitRecommendation = "hold" | "trim" | "exit";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface ExitMetrics {
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  positionWeight: number;
  holdingPeriodDays: number | null;
}

export interface ExitAnalysis {
  ticker: string;
  recommendation: ExitRecommendation;
  confidence: ConfidenceLevel;
  holdingAnalysis: string;
  taxConsiderations: string;
  timingFactors: string[];
  risks: string[];
  targetAction: string;
  summary: string;
  metrics: ExitMetrics;
}

// ── Fetch Function ────────────────────────────────────────────────────────────

async function analyzeExit(input: ExitAdvisorInput): Promise<ExitAnalysis> {
  const res = await fetch("/api/insights/exit-advisor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Exit analysis failed");
  }

  return data;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExitAdvisor() {
  return useMutation({
    mutationFn: analyzeExit,
  });
}
