"use client";

import { Activity, RefreshCw, Lightbulb, Bell, History, Compass, DollarSign, Landmark, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { relativeDate, cn } from "@/lib/utils";
import CurrencyToggle from "./CurrencyToggle";
import PrivacyToggle from "./PrivacyToggle";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";

const NAV_ITEMS = [
  { href: "/explore", label: "Explorar", icon: Compass, accent: "emerald" },
  { href: "/mep", label: "MEP", icon: DollarSign, accent: "yellow" },
  { href: "/funds", label: "Fondos", icon: Landmark, accent: "green" },
  { href: "/history", label: "Historial", icon: History, accent: "cyan" },
  { href: "/insights", label: "Insights", icon: Lightbulb, accent: "amber" },
] as const;

const ACCENT_CLASSES = {
  emerald: {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.08)]",
    inactive: "text-zinc-400 border-transparent hover:text-emerald-400 hover:bg-emerald-500/8 hover:border-emerald-500/20",
  },
  yellow: {
    active: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40 shadow-[0_0_12px_rgba(234,179,8,0.08)]",
    inactive: "text-zinc-400 border-transparent hover:text-yellow-400 hover:bg-yellow-500/8 hover:border-yellow-500/20",
  },
  green: {
    active: "bg-green-500/15 text-green-400 border-green-500/40 shadow-[0_0_12px_rgba(34,197,94,0.08)]",
    inactive: "text-zinc-400 border-transparent hover:text-green-400 hover:bg-green-500/8 hover:border-green-500/20",
  },
  cyan: {
    active: "bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.08)]",
    inactive: "text-zinc-400 border-transparent hover:text-cyan-400 hover:bg-cyan-500/8 hover:border-cyan-500/20",
  },
  amber: {
    active: "bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.08)]",
    inactive: "text-zinc-400 border-transparent hover:text-amber-400 hover:bg-amber-500/8 hover:border-amber-500/20",
  },
  purple: {
    active: "bg-purple-500/15 text-purple-400 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.08)]",
    inactive: "text-zinc-400 border-transparent hover:text-purple-400 hover:bg-purple-500/8 hover:border-purple-500/20",
  },
} as const;

export default function Header() {
  const sync = useAppStore((s) => s.sync);
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileMenuOpen]);

  return (
    <header className="header-glow-line" role="banner">
      {/* Top bar: logo + utilities */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-zinc-100 tracking-tight truncate">
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

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Desktop nav */}
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              const colors = ACCENT_CLASSES[item.accent];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 inline-flex items-center gap-1.5",
                    isActive ? colors.active : colors.inactive
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
            <PriceAlertsButton pathname={pathname} />
          </nav>

          <NotificationBell />
          <PrivacyToggle />
          <CurrencyToggle />
          <UserMenu />

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={cn(
              "md:hidden p-2 rounded-lg border transition-all duration-200",
              mobileMenuOpen
                ? "border-zinc-600 bg-zinc-800 text-zinc-200"
                : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            )}
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile nav — slide-down panel */}
      <div
        ref={menuRef}
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 ease-out",
          mobileMenuOpen ? "max-h-80 opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"
        )}
      >
        <nav
          aria-label="Mobile navigation"
          className="grid grid-cols-3 gap-1.5 p-2 rounded-xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const colors = ACCENT_CLASSES[item.accent];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border text-center transition-all duration-200",
                  isActive ? colors.active : colors.inactive
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[11px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
          <MobilePriceAlertsButton pathname={pathname} onClose={() => setMobileMenuOpen(false)} />
        </nav>
      </div>
    </header>
  );
}

function PriceAlertsButton({ pathname }: { pathname: string }) {
  const openDialog = useAppStore((s) => s.openPriceAlertsDialog);
  const isActive = pathname === "/alerts";
  const colors = ACCENT_CLASSES.purple;

  return (
    <button
      onClick={openDialog}
      className={cn(
        "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 inline-flex items-center gap-1.5",
        isActive ? colors.active : colors.inactive
      )}
      title="Price Alerts"
      aria-label="Price Alerts"
    >
      <Bell className="h-3.5 w-3.5" />
      Alerts
    </button>
  );
}

function MobilePriceAlertsButton({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const openDialog = useAppStore((s) => s.openPriceAlertsDialog);
  const isActive = pathname === "/alerts";
  const colors = ACCENT_CLASSES.purple;

  return (
    <button
      onClick={() => {
        onClose();
        openDialog();
      }}
      className={cn(
        "flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border text-center transition-all duration-200",
        isActive ? colors.active : colors.inactive
      )}
      aria-label="Price Alerts"
    >
      <Bell className="h-4 w-4" />
      <span className="text-[11px] font-medium leading-none">Alerts</span>
    </button>
  );
}
