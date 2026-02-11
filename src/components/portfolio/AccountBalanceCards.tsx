"use client";

import { useIOLBalance } from "@/hooks/useIOLBalance";
import { useIOLStatus } from "@/hooks/useIOLStatus";
import { formatCurrency } from "@/lib/utils";
import { Banknote, DollarSign, Lock, Loader2 } from "lucide-react";

export default function AccountBalanceCards() {
  const { data: status } = useIOLStatus();
  const { data, isLoading, error } = useIOLBalance();

  // Don't show if IOL not connected
  if (!status?.connected) {
    return null;
  }

  if (isLoading) {
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

  if (error || !data?.balances) {
    return null;
  }

  const { balances } = data;

  return (
    <div className="grid gap-3 grid-cols-2">
      {/* ARS Balance */}
      <div className="card-elevated hover-lift p-3">
        <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
          <Banknote className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase tracking-wider">Efectivo ARS</span>
        </div>
        <p data-sensitive className="text-lg font-bold font-mono text-zinc-50">
          {formatCurrency(balances.ars.disponible, "ARS")}
        </p>
        {balances.ars.comprometido > 0 && (
          <div data-sensitive className="flex items-center gap-1 mt-1 text-[10px] text-amber-500">
            <Lock className="h-2.5 w-2.5" />
            <span>
              {formatCurrency(balances.ars.comprometido, "ARS")} en órdenes
            </span>
          </div>
        )}
      </div>

      {/* USD Balance */}
      <div className="card-elevated hover-lift p-3">
        <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
          <DollarSign className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase tracking-wider">Efectivo USD</span>
        </div>
        <p data-sensitive className="text-lg font-bold font-mono text-zinc-50">
          {formatCurrency(balances.usd.disponible, "USD")}
        </p>
        {balances.usd.comprometido > 0 && (
          <div data-sensitive className="flex items-center gap-1 mt-1 text-[10px] text-amber-500">
            <Lock className="h-2.5 w-2.5" />
            <span>
              {formatCurrency(balances.usd.comprometido, "USD")} in orders
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
