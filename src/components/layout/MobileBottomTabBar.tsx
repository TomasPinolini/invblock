"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, X, Bell, Settings } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { MOBILE_PRIMARY_ITEMS, MOBILE_MORE_ITEMS, ALERTS_NAV, ACCENT_CLASSES } from "@/lib/nav";
import { cn } from "@/lib/utils";

export default function MobileBottomTabBar() {
  const pathname = usePathname();
  const isMoreOpen = useAppStore((s) => s.isMobileMoreOpen);
  const openMore = useAppStore((s) => s.openMobileMore);
  const closeMore = useAppStore((s) => s.closeMobileMore);
  const openAlerts = useAppStore((s) => s.openPriceAlertsDialog);

  return (
    <>
      {/* More sheet overlay */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeMore}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 rounded-t-2xl mobile-sheet-enter safe-area-bottom">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-zinc-300">More</h3>
              <button
                onClick={closeMore}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="grid grid-cols-3 gap-1 px-3 pb-4">
              {MOBILE_MORE_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                const colors = ACCENT_CLASSES[item.accent];

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMore}
                    className={cn(
                      "flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-colors",
                      isActive
                        ? colors.active
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </Link>
                );
              })}

              {/* Alerts */}
              <button
                onClick={() => {
                  closeMore();
                  openAlerts();
                }}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-zinc-400 hover:text-purple-400 hover:bg-purple-500/8 transition-colors"
              >
                <Bell className="h-5 w-5" />
                <span className="text-[11px] font-medium">Alerts</span>
              </button>

              {/* Settings */}
              <Link
                href="/settings"
                onClick={closeMore}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
              >
                <Settings className="h-5 w-5" />
                <span className="text-[11px] font-medium">Settings</span>
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/60 safe-area-bottom"
      >
        <div className="flex items-stretch h-16">
          {MOBILE_PRIMARY_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const colors = ACCENT_CLASSES[item.accent];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 transition-colors",
                  isActive
                    ? `text-${item.accent === "blue" ? "blue" : item.accent}-400`
                    : "text-zinc-500"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "drop-shadow-sm")} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {isActive && (
                  <span className={cn("h-0.5 w-4 rounded-full mt-0.5", colors.indicator)} />
                )}
              </Link>
            );
          })}

          {/* More tab */}
          <button
            onClick={isMoreOpen ? closeMore : openMore}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 transition-colors",
              isMoreOpen ? "text-zinc-200" : "text-zinc-500"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
