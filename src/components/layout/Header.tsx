"use client";

import { Activity, RefreshCw, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/stores/useAppStore";
import { relativeDate, cn } from "@/lib/utils";
import CurrencyToggle from "./CurrencyToggle";
import UserMenu from "./UserMenu";

export default function Header() {
  const sync = useAppStore((s) => s.sync);

  return (
    <header className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-zinc-100 truncate">
            <span className="sm:hidden">Portfolio</span>
            <span className="hidden sm:inline">Financial Command Center</span>
          </h1>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="hidden sm:inline">Multi-asset portfolio</span>
            {sync.isActive && (
              <span className="inline-flex items-center gap-1 text-blue-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="hidden xs:inline">Syncing...</span>
              </span>
            )}
            {sync.lastSyncedAt && !sync.isActive && (
              <span className="hidden md:inline">Last synced {relativeDate(sync.lastSyncedAt)}</span>
            )}
            {sync.error && (
              <span className="text-red-400">Sync failed</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <Link
          href="/insights"
          className="p-2 sm:px-3 sm:py-1.5 text-xs font-medium rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1.5"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Insights</span>
        </Link>
        <span className="hidden md:block"><CompactToggle /></span>
        <CurrencyToggle />
        <UserMenu />
      </div>
    </header>
  );
}

function CompactToggle() {
  const compact = useAppStore((s) => s.preferences.compactTable);
  const toggle = useAppStore((s) => s.toggleCompactTable);

  return (
    <button
      onClick={toggle}
      className={cn(
        "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
        compact
          ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
          : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-zinc-300"
      )}
    >
      {compact ? "Compact" : "Comfortable"}
    </button>
  );
}
