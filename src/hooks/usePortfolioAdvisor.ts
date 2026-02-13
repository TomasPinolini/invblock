"use client";

import { useMutation } from "@tanstack/react-query";

// --- Exported types for UI consumption ---

export type RiskTolerance = "conservative" | "moderate" | "aggressive";
export type InvestmentHorizon = "short" | "medium" | "long";

export interface PortfolioAsset {
  ticker: string;
  name: string;
  category: string;
  currency: string;
  quantity: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface HealthFinding {
  type: "strength" | "warning" | "critical";
  title: string;
  description: string;
}

export interface HealthSuggestion {
  priority: "high" | "medium" | "low";
  action: string;
}

export interface AdvisorRecommendation {
  action: "buy" | "sell" | "rebalance" | "hold";
  ticker: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  priority: "high" | "medium" | "low";
}

export interface PortfolioMetrics {
  totalValue: number;
  hhi: number;
  positionCount: number;
  categoryWeights: Record<string, number>;
  currencyExposure: { usd: number; ars: number };
  topHoldings: Array<{ ticker: string; weight: number }>;
}

export interface AdvisorResponse {
  score: number;
  rating: "Excellent" | "Good" | "Fair" | "Poor";
  findings: HealthFinding[];
  suggestions: HealthSuggestion[];
  recommendations: AdvisorRecommendation[];
  marketOutlook: string;
  strategy: string;
  metrics: PortfolioMetrics;
}

export interface AdvisorRequest {
  portfolio: PortfolioAsset[];
  riskTolerance: RiskTolerance;
  investmentHorizon: InvestmentHorizon;
}

// --- Fetch function ---

async function analyzePortfolio(
  request: AdvisorRequest
): Promise<AdvisorResponse> {
  const res = await fetch("/api/insights/health", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Advisor analysis failed");
  }

  return data;
}

// --- Hook ---

export function usePortfolioAdvisor() {
  return useMutation({
    mutationFn: analyzePortfolio,
  });
}
