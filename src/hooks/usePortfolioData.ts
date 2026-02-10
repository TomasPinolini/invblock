"use client";

import { useMemo } from "react";
import { useIOLPortfolio } from "@/hooks/useIOLPortfolio";
import { useBinancePortfolio } from "@/hooks/useBinancePortfolio";
import { useIOLQuotes } from "@/hooks/useIOLQuotes";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import type { PortfolioRow } from "@/components/portfolio/columns";

function calculatePnl(currentPrice: number, averagePrice: number, quantity: number) {
  const pnl = (currentPrice - averagePrice) * quantity;
  const pnlPercent = averagePrice > 0 ? ((currentPrice - averagePrice) / averagePrice) * 100 : 0;
  return { pnl, pnlPercent };
}

/**
 * Merges IOL + Binance portfolios, overlays live quotes,
 * calculates P&L and allocation percentages.
 */
export function usePortfolioData() {
  const {
    data: iolPortfolio,
    isLoading: iolLoading,
    error: iolError,
    refetch: refetchIOL,
    isFetching: iolFetching,
  } = useIOLPortfolio();
  const {
    data: binancePortfolio,
    isLoading: binanceLoading,
    refetch: refetchBinance,
    isFetching: binanceFetching,
  } = useBinancePortfolio();
  const { convertToDisplay, displayCurrency } = useCurrencyConversion();

  // Prepare ticker list for live quotes (IOL assets only)
  const iolTickers = useMemo(() => {
    if (!iolPortfolio?.assets?.length) return [];
    return iolPortfolio.assets.map((a) => ({
      symbol: a.ticker,
      category: a.category,
    }));
  }, [iolPortfolio?.assets]);

  // Fetch live quotes for IOL assets
  const { data: quotesData } = useIOLQuotes(iolTickers, iolPortfolio?.connected ?? false);

  // Combined loading/fetching state
  const isLoading = iolLoading || binanceLoading;
  const isFetching = iolFetching || binanceFetching;
  const error = iolError;

  // Connection states
  const iolConnected = iolPortfolio?.connected;
  const binanceConnected = binancePortfolio?.connected;
  const anyConnected = iolConnected || binanceConnected;
  const iolExpired = iolPortfolio?.expired;

  const refetch = () => {
    refetchIOL();
    refetchBinance();
  };

  // Merge and convert data
  const data: PortfolioRow[] = useMemo(() => {
    const quotes = quotesData?.quotes || {};
    const rows: PortfolioRow[] = [];

    // Add IOL assets
    if (iolPortfolio?.assets?.length) {
      for (const asset of iolPortfolio.assets) {
        const quote = quotes[asset.ticker.toUpperCase()];
        const livePrice = quote?.ultimoPrecio ?? asset.currentPrice;
        const liveValue = livePrice * asset.quantity;
        const dailyChange = quote?.variacionPorcentual ?? null;
        const { pnl, pnlPercent } = calculatePnl(livePrice, asset.averagePrice, asset.quantity);

        rows.push({
          ...asset,
          currentPrice: livePrice,
          currentValue: liveValue,
          pnl,
          pnlPercent,
          source: "iol",
          displayPrice: convertToDisplay(livePrice, asset.currency),
          displayAvgPrice: convertToDisplay(asset.averagePrice, asset.currency),
          displayValue: convertToDisplay(liveValue, asset.currency),
          displayPnl: convertToDisplay(pnl, asset.currency),
          allocation: 0,
          dailyChange,
          hasLiveQuote: !!quote,
        });
      }
    }

    // Add Binance assets
    if (binancePortfolio?.assets?.length) {
      for (const asset of binancePortfolio.assets) {
        const { pnl, pnlPercent } = calculatePnl(asset.currentPrice, asset.averagePrice, asset.quantity);
        rows.push({
          ...asset,
          pnl,
          pnlPercent,
          source: "binance",
          displayPrice: convertToDisplay(asset.currentPrice, asset.currency),
          displayAvgPrice: convertToDisplay(asset.averagePrice, asset.currency),
          displayValue: convertToDisplay(asset.currentValue, asset.currency),
          displayPnl: convertToDisplay(pnl, asset.currency),
          allocation: 0,
          dailyChange: null,
          hasLiveQuote: false,
        });
      }
    }

    // Calculate allocations
    const total = rows.reduce((sum, r) => sum + r.displayValue, 0);
    rows.forEach((r) => {
      r.allocation = total > 0 ? (r.displayValue / total) * 100 : 0;
    });

    return rows;
  }, [iolPortfolio, binancePortfolio, convertToDisplay, quotesData]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    displayCurrency,
    iolConnected,
    binanceConnected,
    anyConnected,
    iolExpired,
  };
}
