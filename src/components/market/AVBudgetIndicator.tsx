"use client";

import type { AVBudgetStatus } from "@/services/alphavantage";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

export function AVBudgetIndicator({ budget }: { budget?: AVBudgetStatus }) {
  if (!budget) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-[10px] font-mono",
        budget.isExhausted
          ? "text-red-400"
          : budget.isWarning
            ? "text-amber-400"
            : "text-zinc-500"
      )}
    >
      <Activity className="h-3 w-3" />
      <span>
        {budget.remaining}/{budget.limit} AV calls left
      </span>
    </div>
  );
}
