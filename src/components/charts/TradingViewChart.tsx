"use client";

import React, { useMemo } from "react";

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  theme?: "dark" | "light";
}

function TradingViewChartInner({
  symbol,
  height = 400,
  theme = "dark",
}: TradingViewChartProps) {
  const src = useMemo(() => {
    const config = {
      autosize: true,
      symbol,
      interval: "D",
      timezone: "America/Argentina/Buenos_Aires",
      theme,
      style: "3",
      locale: "es",
      backgroundColor: "rgba(9, 9, 11, 1)",
      gridColor: "rgba(39, 39, 42, 0.5)",
      hide_side_toolbar: true,
      allow_symbol_change: false,
      calendar: false,
    };
    return `https://s.tradingview.com/embed-widget/advanced-chart/?locale=es#${JSON.stringify(config)}`;
  }, [symbol, theme]);

  return (
    <iframe
      src={src}
      style={{ width: "100%", height }}
      frameBorder="0"
      allowFullScreen
      className="rounded-lg"
    />
  );
}

const TradingViewChart = React.memo(TradingViewChartInner);
export default TradingViewChart;
