"use client";

import { useCallback } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useExchangeRate } from "./useExchangeRate";

/**
 * Shared currency conversion hook.
 * Replaces the duplicated convertToDisplay() in PortfolioTable, PortfolioSummary, AllocationBar.
 */
export function useCurrencyConversion() {
  const displayCurrency = useAppStore((s) => s.preferences.displayCurrency);
  const { rate, isLive, updatedAt } = useExchangeRate();

  const convertToDisplay = useCallback(
    (value: number, assetCurrency: string): number => {
      if (assetCurrency === displayCurrency) return value;
      if (assetCurrency === "ARS" && displayCurrency === "USD") {
        return value / rate;
      }
      if (assetCurrency === "USD" && displayCurrency === "ARS") {
        return value * rate;
      }
      return value;
    },
    [displayCurrency, rate]
  );

  return {
    convertToDisplay,
    displayCurrency,
    rate,
    isLive,
    updatedAt,
  };
}
