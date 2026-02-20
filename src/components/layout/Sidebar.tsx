"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  RefreshCw,
  Pin,
  PinOff,
  Bell,
  Eye,
  EyeOff,
  LogOut,
  User,
  Settings,
} from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAppStore } from "@/stores/useAppStore";
import { useAuth } from "@/hooks/useAuth";
import { NAV_ITEMS, ALERTS_NAV, ACCENT_CLASSES } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Radix tooltip wrapper for collapsed sidebar items */
function SidebarTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;

  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={12}
          className="px-2.5 py-1.5 rounded-md bg-zinc-800 border border-zinc-700/80 text-xs text-zinc-200 whitespace-nowrap z-50 shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const pinned = useAppStore((s) => s.preferences.sidebarPinned);
  const hovered = useAppStore((s) => s.sidebarHovered);
  const setHovered = useAppStore((s) => s.setSidebarHovered);
  const togglePin = useAppStore((s) => s.toggleSidebarPinned);
  const sync = useAppStore((s) => s.sync);
  const openAlerts = useAppStore((s) => s.openPriceAlertsDialog);

  const expanded = pinned || hovered;

  return (
    <Tooltip.Provider delayDuration={200} skipDelayDuration={100}>
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "hidden md:flex flex-col fixed top-0 left-0 h-screen z-30",
        "bg-zinc-950 border-r border-zinc-800/60 sidebar-glow-line",
        "transition-all duration-200 ease-out",
        expanded ? "w-60" : "w-16"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-14 shrink-0 border-b border-zinc-800/40",
          expanded ? "gap-3 px-4" : "justify-center"
        )}
      >
        <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Activity className="h-4 w-4 text-blue-400" />
        </div>
        {expanded && (
          <span className="text-sm font-bold text-zinc-100 truncate">
            Financial CC
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav
        aria-label="Main navigation"
        className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          const colors = ACCENT_CLASSES[item.accent];

          return (
            <SidebarTooltip key={item.href} label={item.label} enabled={!expanded}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex items-center rounded-lg transition-all duration-150",
                  expanded ? "gap-3 px-3 h-9" : "justify-center h-9 mx-auto",
                  isActive
                    ? colors.active
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
                )}
              >
                {isActive && (
                  <span
                    className={cn(
                      "sidebar-nav-active-indicator",
                      colors.indicator
                    )}
                  />
                )}

                <Icon className="h-[18px] w-[18px] shrink-0" />

                {expanded && (
                  <span className="text-[13px] font-medium truncate">
                    {item.label}
                  </span>
                )}
              </Link>
            </SidebarTooltip>
          );
        })}

        {/* Alerts button */}
        <SidebarTooltip label={ALERTS_NAV.label} enabled={!expanded}>
          <button
            onClick={openAlerts}
            className={cn(
              "relative flex items-center rounded-lg transition-all duration-150 w-full",
              expanded ? "gap-3 px-3 h-9" : "justify-center h-9",
              "text-zinc-500 hover:text-purple-400 hover:bg-purple-500/8"
            )}
          >
            <Bell className="h-[18px] w-[18px] shrink-0" />
            {expanded && (
              <span className="text-[13px] font-medium truncate">
                {ALERTS_NAV.label}
              </span>
            )}
          </button>
        </SidebarTooltip>

        {/* Settings */}
        <SidebarTooltip label="Configuracion" enabled={!expanded}>
          <Link
            href="/settings"
            className={cn(
              "relative flex items-center rounded-lg transition-all duration-150",
              expanded ? "gap-3 px-3 h-9" : "justify-center h-9",
              pathname === "/settings"
                ? "bg-zinc-800/60 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
            )}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            {expanded && (
              <span className="text-[13px] font-medium truncate">Configuracion</span>
            )}
          </Link>
        </SidebarTooltip>
      </nav>

      {/* Sync status — subtle indicator */}
      {sync.isActive && (
        <div className={cn("px-3 pb-2", expanded ? "" : "flex justify-center")}>
          <div className="flex items-center gap-1.5 text-blue-400 text-[11px]">
            <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
            {expanded && <span>Sincronizando...</span>}
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="border-t border-zinc-800/40 shrink-0">
        {/* Utility row */}
        <UtilityRow expanded={expanded} />

        {/* User + Pin */}
        <SidebarUser expanded={expanded} />

        {/* Pin toggle */}
        <div
          className={cn(
            "border-t border-zinc-800/40 py-2",
            expanded ? "px-3" : "flex justify-center"
          )}
        >
          <button
            onClick={togglePin}
            className={cn(
              "relative flex items-center rounded-lg transition-colors group",
              expanded ? "gap-2 px-2 py-1.5 w-full" : "p-1.5",
              pinned
                ? "text-blue-400 hover:bg-blue-500/10"
                : "text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50"
            )}
            title={pinned ? "Desfijar barra lateral" : "Fijar barra lateral"}
          >
            {pinned ? (
              <PinOff className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Pin className="h-3.5 w-3.5 shrink-0" />
            )}
            {expanded && (
              <span className="text-xs">
                {pinned ? "Desfijar" : "Fijar"}
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
    </Tooltip.Provider>
  );
}

/** Privacy + Currency toggles — compact row */
function UtilityRow({ expanded }: { expanded: boolean }) {
  const privacyMode = useAppStore((s) => s.preferences.privacyMode);
  const togglePrivacy = useAppStore((s) => s.togglePrivacyMode);
  const currency = useAppStore((s) => s.preferences.displayCurrency);
  const setCurrency = useAppStore((s) => s.setDisplayCurrency);

  return (
    <div
      className={cn(
        "py-2",
        expanded ? "px-3 flex items-center gap-1" : "flex flex-col items-center gap-1 px-1"
      )}
    >
      {/* Privacy toggle */}
      <button
        onClick={togglePrivacy}
        className={cn(
          "rounded-md transition-colors",
          expanded ? "p-1.5" : "p-2",
          privacyMode
            ? "text-violet-400 bg-violet-500/10 hover:bg-violet-500/20"
            : "text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50"
        )}
        title={privacyMode ? "Mostrar valores" : "Ocultar valores"}
        aria-label={privacyMode ? "Desactivar modo privado" : "Activar modo privado"}
      >
        {privacyMode ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Currency toggle */}
      {expanded ? (
        <div className="inline-flex rounded-md bg-zinc-900 border border-zinc-800/60 p-0.5">
          {(["USD", "ARS"] as const).map((cur) => (
            <button
              key={cur}
              onClick={() => setCurrency(cur)}
              className={cn(
                "px-2 py-0.5 text-[11px] font-semibold rounded transition-colors",
                currency === cur
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-400"
              )}
            >
              {cur}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setCurrency(currency === "USD" ? "ARS" : "USD")}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50 transition-colors text-[10px] font-bold leading-none"
          title={`Cambiar a ${currency === "USD" ? "ARS" : "USD"}`}
        >
          {currency}
        </button>
      )}
    </div>
  );
}

/** User avatar + email + sign out */
function SidebarUser({ expanded }: { expanded: boolean }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
  };

  return (
    <div
      className={cn(
        "border-t border-zinc-800/40 py-2",
        expanded ? "px-3" : "flex justify-center"
      )}
    >
      {expanded ? (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
            <User className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors shrink-0"
            title="Cerrar sesion"
            aria-label="Cerrar sesion"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <SidebarTooltip label="Cerrar sesion" enabled>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            aria-label="Cerrar sesion"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </SidebarTooltip>
      )}
    </div>
  );
}
