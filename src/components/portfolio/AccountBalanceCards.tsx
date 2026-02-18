"use client";

import { useIOLBalance } from "@/hooks/useIOLBalance";
import { useIOLStatus } from "@/hooks/useIOLStatus";
import { usePPIBalance } from "@/hooks/usePPIBalance";
import { usePPIStatus } from "@/hooks/usePPIStatus";
import { formatCurrency } from "@/lib/utils";
import { Banknote, DollarSign, Lock, Loader2 } from "lucide-react";

export default function AccountBalanceCards() {
  const { data: iolStatus } = useIOLStatus();
  const { data: iolData, isLoading: iolLoading, error: iolError } = useIOLBalance();
  const { data: ppiStatus } = usePPIStatus();
  const { data: ppiData, isLoading: ppiLoading, error: ppiError } = usePPIBalance();

  const showIOL = iolStatus?.connected;
  const showPPI = ppiStatus?.connected;

  if (!showIOL && !showPPI) {
    return null;
  }

  if ((showIOL && iolLoading) || (showPPI && ppiLoading)) {
    return (
      <div className="grid gap-3 grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="card-elevated hover-lift p-3 flex items-center justify-center"
          >
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* IOL Balances */}
      {showIOL && !iolError && iolData?.balances && (
        <div className="grid gap-3 grid-cols-2">
          {/* IOL ARS */}
          <div className="card-elevated hover-lift p-3">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <Banknote className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider">
                {showPPI ? "IOL " : ""}Efectivo ARS
              </span>
            </div>
            <p data-sensitive className="text-lg font-bold font-mono text-zinc-50">
              {formatCurrency(iolData.balances.ars.disponible, "ARS")}
            </p>
            {iolData.balances.ars.comprometido > 0 && (
              <div data-sensitive className="flex items-center gap-1 mt-1 text-[10px] text-amber-500">
                <Lock className="h-2.5 w-2.5" />
                <span>
                  {formatCurrency(iolData.balances.ars.comprometido, "ARS")} en ordenes
                </span>
              </div>
            )}
          </div>

          {/* IOL USD */}
          <div className="card-elevated hover-lift p-3">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider">
                {showPPI ? "IOL " : ""}Efectivo USD
              </span>
            </div>
            <p data-sensitive className="text-lg font-bold font-mono text-zinc-50">
              {formatCurrency(iolData.balances.usd.disponible, "USD")}
            </p>
            {iolData.balances.usd.comprometido > 0 && (
              <div data-sensitive className="flex items-center gap-1 mt-1 text-[10px] text-amber-500">
                <Lock className="h-2.5 w-2.5" />
                <span>
                  {formatCurrency(iolData.balances.usd.comprometido, "USD")} in orders
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PPI Balances */}
      {showPPI && !ppiError && ppiData?.balances && (
        <div className="grid gap-3 grid-cols-2">
          {/* PPI ARS */}
          <div className="card-elevated hover-lift p-3">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <Banknote className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider">
                <span className="text-violet-400">PPI</span> Efectivo ARS
              </span>
            </div>
            <p data-sensitive className="text-lg font-bold font-mono text-zinc-50">
              {formatCurrency(ppiData.balances.ars.disponible, "ARS")}
            </p>
            {ppiData.balances.ars.comprometido > 0 && (
              <div data-sensitive className="flex items-center gap-1 mt-1 text-[10px] text-amber-500">
                <Lock className="h-2.5 w-2.5" />
                <span>
                  {formatCurrency(ppiData.balances.ars.comprometido, "ARS")} en ordenes
                </span>
              </div>
            )}
          </div>

          {/* PPI USD */}
          <div className="card-elevated hover-lift p-3">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider">
                <span className="text-violet-400">PPI</span> Efectivo USD
              </span>
            </div>
            <p data-sensitive className="text-lg font-bold font-mono text-zinc-50">
              {formatCurrency(ppiData.balances.usd.disponible, "USD")}
            </p>
            {ppiData.balances.usd.comprometido > 0 && (
              <div data-sensitive className="flex items-center gap-1 mt-1 text-[10px] text-amber-500">
                <Lock className="h-2.5 w-2.5" />
                <span>
                  {formatCurrency(ppiData.balances.usd.comprometido, "USD")} in orders
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
