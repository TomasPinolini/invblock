"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useAppStore } from "@/stores/useAppStore";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";
import MobileTopBar from "./MobileTopBar";
import MobileBottomTabBar from "./MobileBottomTabBar";

const AssetEntryDialog = dynamic(
  () => import("@/components/forms/AssetEntryDialog")
);
const TransactionEntryDialog = dynamic(
  () => import("@/components/forms/TransactionEntryDialog")
);
const PriceAlertsDialog = dynamic(
  () => import("@/components/forms/PriceAlertsDialog")
);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pinned = useAppStore((s) => s.preferences.sidebarPinned);
  const hovered = useAppStore((s) => s.sidebarHovered);

  // Auth pages render without shell
  if (pathname.startsWith("/auth")) {
    return <main id="main-content">{children}</main>;
  }

  const expanded = pinned || hovered;

  return (
    <div className="app-layout">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Sidebar spacer — takes up grid column space on desktop */}
      <div
        className={cn(
          "hidden md:block shrink-0 transition-all duration-200",
          expanded ? "w-60" : "w-16"
        )}
      />

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <MobileTopBar />

        {/* Page content */}
        <main id="main-content" className="flex-1 app-content-mobile">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileBottomTabBar />

      {/* Global dialogs */}
      <AssetEntryDialog />
      <TransactionEntryDialog />
      <PriceAlertsDialog />
    </div>
  );
}
