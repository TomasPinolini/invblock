"use client";

import { useAppStore } from "@/stores/useAppStore";
import { cn } from "@/lib/utils";

export default function CurrencyToggle() {
  const currency = useAppStore((s) => s.preferences.displayCurrency);
  const set = useAppStore((s) => s.setDisplayCurrency);

  return (
    <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/50 p-0.5">
      {(["USD", "ARS"] as const).map((cur) => (
        <button
          key={cur}
          onClick={() => set(cur)}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
            currency === cur
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          {cur}
        </button>
      ))}
    </div>
  );
}
