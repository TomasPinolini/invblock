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

  // Auth pages render without shell
  if (pathname.startsWith("/auth")) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <div className="app-layout md:h-screen md:overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Sidebar spacer — fixed width; only widens when pinned (hover overlays) */}
      <div
        className={cn(
          "hidden md:block shrink-0 transition-all duration-200",
          pinned ? "w-60" : "w-16"
        )}
      />

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col md:h-screen">
        {/* Mobile top bar */}
        <MobileTopBar />

        {/* Page content */}
        <main id="main-content" className="flex-1 app-content-mobile md:overflow-y-auto">
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
