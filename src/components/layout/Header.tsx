"use client";

import { Activity, RefreshCw, Lightbulb, Bell, History, Compass, DollarSign, Landmark } from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/stores/useAppStore";
import { relativeDate } from "@/lib/utils";
import CurrencyToggle from "./CurrencyToggle";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";

export default function Header() {
  const sync = useAppStore((s) => s.sync);

  return (
    <header className="flex items-center justify-between gap-2" role="banner">
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
              <span className="inline-flex items-center gap-1 text-blue-400" aria-live="polite">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="hidden xs:inline">Syncing...</span>
              </span>
            )}
            {sync.lastSyncedAt && !sync.isActive && (
              <span className="hidden md:inline">Last synced {relativeDate(sync.lastSyncedAt)}</span>
            )}
            {sync.error && (
              <span className="text-red-400" aria-live="assertive">Sync failed</span>
            )}
          </div>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <Link
          href="/explore"
          className="p-2 sm:px-3 sm:py-1.5 text-xs font-medium rounded-lg border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors inline-flex items-center gap-1.5"
        >
          <Compass className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Explorar</span>
        </Link>
        <Link
          href="/mep"
          className="p-2 sm:px-3 sm:py-1.5 text-xs font-medium rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors inline-flex items-center gap-1.5"
        >
          <DollarSign className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">MEP</span>
        </Link>
        <Link
          href="/funds"
          className="p-2 sm:px-3 sm:py-1.5 text-xs font-medium rounded-lg border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors inline-flex items-center gap-1.5"
        >
          <Landmark className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Fondos</span>
        </Link>
        <Link
          href="/history"
          className="p-2 sm:px-3 sm:py-1.5 text-xs font-medium rounded-lg border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors inline-flex items-center gap-1.5"
        >
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Historial</span>
        </Link>
        <Link
          href="/insights"
          className="p-2 sm:px-3 sm:py-1.5 text-xs font-medium rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1.5"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Insights</span>
        </Link>
        <PriceAlertsButton />
        <NotificationBell />
        <CurrencyToggle />
        <UserMenu />
      </nav>
    </header>
  );
}

function PriceAlertsButton() {
  const openDialog = useAppStore((s) => s.openPriceAlertsDialog);

  return (
    <button
      onClick={openDialog}
      className="p-2 sm:px-3 sm:py-1.5 text-xs font-medium rounded-lg border border-purple-500/50 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors inline-flex items-center gap-1.5"
      title="Price Alerts"
      aria-label="Price Alerts"
    >
      <Bell className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Alerts</span>
    </button>
  );
}
