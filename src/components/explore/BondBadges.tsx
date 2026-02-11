"use client";

import { CalendarClock } from "lucide-react";
import { getBondMeta, getMaturityInfo, getParity } from "@/lib/bond-metadata";
import { cn } from "@/lib/utils";

interface BondBadgesProps {
  ticker: string;
  currentPrice: number;
}

export function BondBadges({ ticker, currentPrice }: BondBadgesProps) {
  const meta = getBondMeta(ticker);
  if (!meta) return null;

  const maturityInfo = getMaturityInfo(ticker);
  const parity = currentPrice > 0 ? getParity(ticker, currentPrice) : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {/* Law badge */}
      {meta.law === "argentina" && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-blue-500/15 text-blue-400 border-blue-500/30">
          Ley AR
        </span>
      )}
      {meta.law === "new_york" && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
          Ley NY
        </span>
      )}

      {/* Currency badge */}
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-transparent",
          meta.currency === "USD" && "bg-green-500/15 text-green-300",
          meta.currency === "ARS" && "bg-violet-500/15 text-violet-300",
          meta.currency === "CER" && "bg-orange-500/15 text-orange-300",
          meta.currency === "USD-linked" && "bg-teal-500/15 text-teal-300"
        )}
      >
        {meta.currency}
      </span>

      {/* Maturity countdown */}
      {maturityInfo && (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono border border-transparent",
            maturityInfo.isExpired ? "text-red-400" : "text-zinc-400"
          )}
        >
          <CalendarClock className="h-3 w-3" />
          {maturityInfo.remaining}
        </span>
      )}

      {/* Parity */}
      {parity !== null && (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono border border-transparent",
            parity < 50 ? "text-amber-400" : "text-zinc-400"
          )}
        >
          Paridad {parity.toFixed(1)}%
        </span>
      )}

      {/* Issuer (ONs only) */}
      {meta.issuer && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-zinc-800 text-zinc-400 border-zinc-700">
          {meta.issuer}
        </span>
      )}
    </div>
  );
}
