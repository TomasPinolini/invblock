"use client";

import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Settings,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/", active: true },
  { icon: Wallet, label: "Assets", href: "/assets" },
  { icon: ArrowRightLeft, label: "Transactions", href: "/transactions" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950/50 min-h-screen">
      <div className="p-4">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">FC</span>
          </div>
          <span className="font-semibold text-zinc-100">FCC</span>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                item.active
                  ? "bg-zinc-800/50 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.active && (
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              )}
            </a>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800/50">
        <div className="px-3 py-2">
          <p className="text-xs text-zinc-600">Read-only analysis tool</p>
          <p className="text-xs text-zinc-700 mt-1">v0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
