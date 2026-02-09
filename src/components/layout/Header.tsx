"use client";

import { Activity, RefreshCw } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { relativeDate, cn } from "@/lib/utils";
import CurrencyToggle from "./CurrencyToggle";
import UserMenu from "./UserMenu";

export default function Header() {
  const sync = useAppStore((s) => s.sync);

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-600/20 flex items-center justify-center">
          <Activity className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">
            Financial Command Center
          </h1>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Multi-asset portfolio</span>
            {sync.isActive && (
              <span className="inline-flex items-center gap-1 text-blue-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Syncing...
              </span>
            )}
            {sync.lastSyncedAt && !sync.isActive && (
              <span>Last synced {relativeDate(sync.lastSyncedAt)}</span>
            )}
            {sync.error && (
              <span className="text-red-400">Sync failed</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CompactToggle />
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
