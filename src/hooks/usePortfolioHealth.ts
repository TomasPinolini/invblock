"use client";

import { useMutation } from "@tanstack/react-query";

// --- Exported types for UI consumption ---

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

export interface PortfolioMetrics {
  totalValue: number;
  hhi: number;
  positionCount: number;
  categoryWeights: Record<string, number>;
  currencyExposure: { usd: number; ars: number };
  topHoldings: Array<{ ticker: string; weight: number }>;
}

export interface HealthScoreResponse {
  score: number;
  rating: "Excellent" | "Good" | "Fair" | "Poor";
  findings: HealthFinding[];
  suggestions: HealthSuggestion[];
  metrics: PortfolioMetrics;
}

// --- Fetch function ---

async function analyzePortfolioHealth(
  portfolio: PortfolioAsset[]
): Promise<HealthScoreResponse> {
  const res = await fetch("/api/insights/health", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ portfolio }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Health analysis failed");
  }

  return data;
}

// --- Hook ---

export function usePortfolioHealth() {
  return useMutation({
    mutationFn: analyzePortfolioHealth,
  });
}
