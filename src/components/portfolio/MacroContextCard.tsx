"use client";

import { Globe2, RefreshCw, AlertTriangle } from "lucide-react";
import { useMacroData } from "@/hooks/useMacroData";
import { cn } from "@/lib/utils";

function Indicator({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string | null;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className={cn("text-sm font-mono font-semibold", color || "text-zinc-200")}>
        {value ?? "–"}
        {value && suffix ? <span className="text-xs text-zinc-500 ml-0.5">{suffix}</span> : null}
      </p>
    </div>
  );
}

export default function MacroContextCard() {
  const { data, isLoading, error, refetch, isFetching } = useMacroData();

  const blue = data?.dollars.find((d) => d.name === "Blue");
  const mep = data?.dollars.find((d) => d.name === "MEP");
  const ccl = data?.dollars.find((d) => d.name === "CCL");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold">Argentine Macro</h3>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1 rounded-md hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
          aria-label="Refresh macro data"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-2 bg-zinc-800 rounded w-12 mx-auto" />
              <div className="h-4 bg-zinc-800 rounded w-16 mx-auto" />
            </div>
          ))}
        </div>
      )}

      {error && !data && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <AlertTriangle className="h-3.5 w-3.5" />
          Failed to load macro data
        </div>
      )}

      {data && (
        <div className="grid grid-cols-4 gap-x-3 gap-y-2.5">
          {/* Dollar rates */}
          <Indicator
            label="Blue"
            value={blue?.sell?.toFixed(0) ?? null}
            suffix="ARS"
          />
          <Indicator
            label="MEP"
            value={mep?.sell?.toFixed(0) ?? null}
            suffix="ARS"
          />
          <Indicator
            label="CCL"
            value={ccl?.sell?.toFixed(0) ?? null}
            suffix="ARS"
          />
          <Indicator
            label="Country Risk"
            value={data.countryRisk?.toFixed(0) ?? null}
            suffix="bp"
            color={
              data.countryRisk
                ? data.countryRisk > 1500
                  ? "text-red-400"
                  : data.countryRisk > 800
                    ? "text-amber-400"
                    : "text-emerald-400"
                : undefined
            }
          />

          {/* Second row */}
          <Indicator
            label="Interest"
            value={data.interestRate?.toFixed(1) ?? null}
            suffix="%"
          />
          <Indicator
            label="Reserves"
            value={
              data.reserves
                ? `${(data.reserves / 1000).toFixed(1)}B`
                : null
            }
            suffix="USD"
          />
          <Indicator
            label="CPI (mo)"
            value={data.monthlyCpi?.toFixed(1) ?? null}
            suffix="%"
            color={
              data.monthlyCpi
                ? data.monthlyCpi > 5
                  ? "text-red-400"
                  : data.monthlyCpi > 3
                    ? "text-amber-400"
                    : "text-emerald-400"
                : undefined
            }
          />
          <Indicator
            label="Blue Spread"
            value={blue?.spread?.toFixed(0) ?? null}
            suffix="ARS"
          />
        </div>
      )}

      {data && data.errors.length > 0 && (
        <p className="text-[10px] text-zinc-500 mt-2">
          {data.errors.length} indicator{data.errors.length > 1 ? "s" : ""} unavailable
        </p>
      )}
    </div>
  );
}
