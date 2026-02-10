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

export interface EvaluateTradeInput {
  ticker: string;
  quantity?: number;
  portfolio: PortfolioAsset[];
}

// ── Response Types ────────────────────────────────────────────────────────────

export type TradeVerdict = "buy" | "hold" | "avoid";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface CurrentExposure {
  alreadyHeld: boolean;
  currentAllocation: number;
  category: string | null;
}

export interface TradeEvaluation {
  ticker: string;
  verdict: TradeVerdict;
  confidence: ConfidenceLevel;
  score: number;
  pros: string[];
  cons: string[];
  portfolioImpact: string;
  alternativeConsideration: string | null;
  summary: string;
  currentExposure: CurrentExposure;
}

// ── Fetch Function ────────────────────────────────────────────────────────────

async function evaluateTrade(
  input: EvaluateTradeInput
): Promise<TradeEvaluation> {
  const res = await fetch("/api/insights/evaluate-trade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Trade evaluation failed");
  }

  return data;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Mutation hook for evaluating whether a trade makes sense
 * given the user's current portfolio composition.
 *
 * Usage:
 * ```tsx
 * const { mutate, data, isPending, error } = useTradeEvaluator();
 * mutate({ ticker: "GGAL", quantity: 10, portfolio: [...] });
 * ```
 */
export function useTradeEvaluator() {
  return useMutation({
    mutationFn: evaluateTrade,
  });
}
