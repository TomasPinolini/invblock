"use client";

import { useState } from "react";
import { useTickerHistory } from "@/hooks/useHistoricalPrices";
import { useIOLQuote } from "@/hooks/useIOLQuotes";
import { useIOLHistorical, getDateRangeForPeriod } from "@/hooks/useIOLHistorical";
import { getTradingViewSymbol } from "@/lib/tradingview";
import type { TimePeriod } from "@/services/yahoo/client";

type DataSource = "yahoo" | "iol";

interface UseAssetDetailParams {
  ticker: string;
  category: "stock" | "cedear" | "crypto" | "cash";
  currency: "USD" | "ARS";
  source?: "iol" | "binance" | "ppi";
  quantity: number;
  averagePrice: number;
  currentPrice: number;
}

export function useAssetDetail(asset: UseAssetDetailParams) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1M");
  const [dataSource, setDataSource] = useState<DataSource>("yahoo");

  const tvSymbol = getTradingViewSymbol(asset.ticker, asset.category);
  const isIOL = asset.source === "iol";

  // Live quote (IOL only)
  const { data: liveQuote, isLoading: quoteLoading } = useIOLQuote(
    asset.ticker,
    undefined,
    isIOL
  );

  // Date range for IOL historical
  const dateRange = getDateRangeForPeriod(selectedPeriod);

  // Yahoo Finance history
  const {
    data: yahooHistoryData,
    isLoading: yahooLoading,
    error: yahooError,
  } = useTickerHistory(
    asset.ticker,
    asset.category,
    selectedPeriod,
    dataSource === "yahoo"
  );

  // IOL history
  const {
    data: iolHistoryData,
    isLoading: iolLoading,
    error: iolError,
  } = useIOLHistorical({
    symbol: asset.ticker,
    category: asset.category,
    from: dateRange.from,
    to: dateRange.to,
    enabled: dataSource === "iol" && isIOL,
  });

  // Select active data source
  const historyData = dataSource === "yahoo" ? yahooHistoryData : iolHistoryData;
  const isLoading = dataSource === "yahoo" ? yahooLoading : iolLoading;
  const error = dataSource === "yahoo" ? yahooError : iolError;

  // Period P&L
  const periodPnl = (() => {
    if (!historyData?.history?.length) return null;
    const startPrice = historyData.history[0]?.close;
    const endPrice = asset.currentPrice;
    if (!startPrice || startPrice <= 0) return null;
    const pnlPercent = ((endPrice - startPrice) / startPrice) * 100;
    const pnlValue = (endPrice - startPrice) * asset.quantity;
    return { startPrice, pnlPercent, pnlValue };
  })();

  // Total P&L (since purchase)
  const totalPnl = (asset.currentPrice - asset.averagePrice) * asset.quantity;
  const totalPnlPercent =
    asset.averagePrice > 0
      ? ((asset.currentPrice - asset.averagePrice) / asset.averagePrice) * 100
      : 0;

  return {
    liveQuote,
    quoteLoading,
    historyData,
    isLoading,
    error,
    selectedPeriod,
    setSelectedPeriod,
    dataSource,
    setDataSource,
    periodPnl,
    totalPnl,
    totalPnlPercent,
    tvSymbol,
    isIOL,
  };
}
