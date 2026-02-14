"use client";

import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { GroupPriceSecurity } from "@/hooks/useWatchlistGroups";

interface GroupTickerCardProps {
  security: GroupPriceSecurity;
  onRemove: () => void;
  isRemoving?: boolean;
}

export function GroupTickerCard({ security, onRemove, isRemoving }: GroupTickerCardProps) {
  const change = security.variacionPorcentual;
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div className="group relative rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 hover:border-zinc-700/80 transition-all duration-200">
      {/* Remove button */}
      <button
        onClick={onRemove}
        disabled={isRemoving}
        className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        aria-label={`Remove ${security.simbolo}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Ticker + Name */}
      <div className="mb-2">
        <p className="font-mono text-sm font-semibold text-zinc-100 tracking-wide">
          {security.simbolo}
        </p>
        <p className="text-[11px] text-zinc-500 truncate max-w-[140px]">
          {security.descripcion}
        </p>
      </div>

      {/* Price */}
      <p className="font-mono text-lg font-bold text-zinc-100 mb-1">
        {security.ultimoPrecio > 0
          ? formatCurrency(security.ultimoPrecio)
          : "—"}
      </p>

      {/* Change */}
      <div
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium font-mono",
          isPositive && "text-emerald-400",
          isNegative && "text-red-400",
          !isPositive && !isNegative && "text-zinc-500"
        )}
      >
        {isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : isNegative ? (
          <TrendingDown className="h-3 w-3" />
        ) : (
          <Minus className="h-3 w-3" />
        )}
        {formatPercent(change)}
      </div>
    </div>
  );
}
