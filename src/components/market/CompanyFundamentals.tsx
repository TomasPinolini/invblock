"use client";

import { Building2, Loader2, Target, Users, TrendingUp, TrendingDown } from "lucide-react";
import { useCompanyOverview } from "@/hooks/useAlphaVantage";
import { AVBudgetIndicator } from "./AVBudgetIndicator";
import { cn } from "@/lib/utils";

function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm font-mono font-semibold", color || "text-zinc-200")}>
        {value}
      </p>
    </div>
  );
}

function AnalystBar({
  strongBuy,
  buy,
  hold,
  sell,
  strongSell,
}: {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}) {
  const total = strongBuy + buy + hold + sell + strongSell;
  if (total === 0) return null;

  const segments = [
    { count: strongBuy, color: "bg-emerald-500", label: "Strong Buy" },
    { count: buy, color: "bg-emerald-400/70", label: "Buy" },
    { count: hold, color: "bg-zinc-500", label: "Hold" },
    { count: sell, color: "bg-red-400/70", label: "Sell" },
    { count: strongSell, color: "bg-red-500", label: "Strong Sell" },
  ].filter((s) => s.count > 0);

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <Users className="h-3 w-3 text-zinc-500" />
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
          Analyst Ratings ({total})
        </p>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn("h-full rounded-sm", seg.color)}
            style={{ width: `${(seg.count / total) * 100}%` }}
            title={`${seg.label}: ${seg.count}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-emerald-400">
          {strongBuy + buy} Buy
        </span>
        <span className="text-[10px] text-zinc-500">{hold} Hold</span>
        <span className="text-[10px] text-red-400">
          {sell + strongSell} Sell
        </span>
      </div>
    </div>
  );
}

export default function CompanyFundamentals({
  symbol,
}: {
  symbol: string;
}) {
  const { data: response, isLoading, error } = useCompanyOverview(symbol);

  const company = response?.data;
  const budget = response?.budget;

  if (isLoading) {
    return (
      <div className="bg-zinc-800/50 rounded-lg p-3">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span className="ml-2 text-xs text-zinc-500">Loading fundamentals...</span>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return null; // Silently hide if no data (avoid clutter in modal)
  }

  const week52Range =
    company.week52Low > 0 && company.week52High > 0
      ? `$${company.week52Low.toFixed(2)} — $${company.week52High.toFixed(2)}`
      : null;

  return (
    <div className="bg-zinc-800/50 rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-zinc-300">Fundamentals</span>
          {company.sector && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
              {company.sector}
            </span>
          )}
        </div>
        <AVBudgetIndicator budget={budget} />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        {company.peRatio > 0 && (
          <Stat label="P/E Ratio" value={company.peRatio.toFixed(1)} />
        )}
        {company.eps !== 0 && (
          <Stat
            label="EPS"
            value={`$${company.eps.toFixed(2)}`}
            color={company.eps > 0 ? "text-emerald-400" : "text-red-400"}
          />
        )}
        {company.marketCap > 0 && (
          <Stat label="Market Cap" value={formatLargeNumber(company.marketCap)} />
        )}
        {company.dividendYield > 0 && (
          <Stat
            label="Dividend Yield"
            value={`${(company.dividendYield * 100).toFixed(2)}%`}
            color="text-blue-400"
          />
        )}
        {company.beta > 0 && (
          <Stat label="Beta" value={company.beta.toFixed(2)} />
        )}
        {company.profitMargin !== 0 && (
          <Stat
            label="Profit Margin"
            value={`${(company.profitMargin * 100).toFixed(1)}%`}
            color={company.profitMargin > 0 ? "text-emerald-400" : "text-red-400"}
          />
        )}
      </div>

      {/* 52-Week Range */}
      {week52Range && (
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">52-Week Range</p>
          <p className="text-xs font-mono text-zinc-300">{week52Range}</p>
        </div>
      )}

      {/* Analyst Target */}
      {company.analystTargetPrice > 0 && (
        <div className="flex items-center gap-2">
          <Target className="h-3 w-3 text-zinc-500" />
          <p className="text-[10px] text-zinc-500">Analyst Target:</p>
          <p className="text-xs font-mono font-semibold text-blue-400">
            ${company.analystTargetPrice.toFixed(2)}
          </p>
        </div>
      )}

      {/* Growth */}
      {(company.quarterlyRevenueGrowthYOY !== 0 || company.quarterlyEarningsGrowthYOY !== 0) && (
        <div className="grid grid-cols-2 gap-3">
          {company.quarterlyRevenueGrowthYOY !== 0 && (
            <div className="flex items-center gap-1.5">
              {company.quarterlyRevenueGrowthYOY > 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-400" />
              )}
              <div>
                <p className="text-[10px] text-zinc-500">Rev Growth YoY</p>
                <p
                  className={cn(
                    "text-xs font-mono font-semibold",
                    company.quarterlyRevenueGrowthYOY > 0 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {(company.quarterlyRevenueGrowthYOY * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          )}
          {company.quarterlyEarningsGrowthYOY !== 0 && (
            <div className="flex items-center gap-1.5">
              {company.quarterlyEarningsGrowthYOY > 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-400" />
              )}
              <div>
                <p className="text-[10px] text-zinc-500">Earnings Growth YoY</p>
                <p
                  className={cn(
                    "text-xs font-mono font-semibold",
                    company.quarterlyEarningsGrowthYOY > 0 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {(company.quarterlyEarningsGrowthYOY * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analyst Ratings Bar */}
      <AnalystBar
        strongBuy={company.analystRatingStrongBuy}
        buy={company.analystRatingBuy}
        hold={company.analystRatingHold}
        sell={company.analystRatingSell}
        strongSell={company.analystRatingStrongSell}
      />
    </div>
  );
}
