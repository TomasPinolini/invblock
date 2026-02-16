"use client";

import { Activity } from "lucide-react";
import PrivacyToggle from "./PrivacyToggle";
import CurrencyToggle from "./CurrencyToggle";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";

export default function MobileTopBar() {
  return (
    <header className="md:hidden flex items-center justify-between h-12 px-3 bg-zinc-950 border-b border-zinc-800/60 z-30 sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-blue-600/20 border border-blue-500/20 flex items-center justify-center">
          <Activity className="h-4 w-4 text-blue-400" />
        </div>
        <span className="text-sm font-bold text-zinc-100">FCC</span>
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-1.5">
        <NotificationBell />
        <PrivacyToggle />
        <CurrencyToggle />
        <UserMenu />
      </div>
    </header>
  );
}
