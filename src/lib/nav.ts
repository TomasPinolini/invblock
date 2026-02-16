import {
  Activity,
  Compass,
  LayoutDashboard,
  DollarSign,
  Landmark,
  History,
  Lightbulb,
  Bell,
  type LucideIcon,
} from "lucide-react";

export type AccentColor =
  | "blue"
  | "emerald"
  | "yellow"
  | "green"
  | "cyan"
  | "amber"
  | "purple";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  accent: AccentColor;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Portfolio", icon: Activity, accent: "blue" },
  { href: "/explore", label: "Explorar", icon: Compass, accent: "emerald" },
  { href: "/dashboards", label: "Dashboards", icon: LayoutDashboard, accent: "blue" },
  { href: "/mep", label: "MEP", icon: DollarSign, accent: "yellow" },
  { href: "/funds", label: "Fondos", icon: Landmark, accent: "green" },
  { href: "/history", label: "Historial", icon: History, accent: "cyan" },
  { href: "/insights", label: "Insights", icon: Lightbulb, accent: "amber" },
];

/** Items shown in mobile bottom tab bar (max 4 + "More") */
export const MOBILE_PRIMARY_ITEMS: NavItem[] = [
  NAV_ITEMS[0], // Portfolio
  NAV_ITEMS[1], // Explorar
  NAV_ITEMS[2], // Dashboards
  NAV_ITEMS[3], // MEP
];

/** Items shown in "More" sheet on mobile */
export const MOBILE_MORE_ITEMS: NavItem[] = [
  NAV_ITEMS[4], // Fondos
  NAV_ITEMS[5], // Historial
  NAV_ITEMS[6], // Insights
];

export const ALERTS_NAV: NavItem = {
  href: "/alerts",
  label: "Alerts",
  icon: Bell,
  accent: "purple",
};

export const ACCENT_CLASSES: Record<
  AccentColor,
  { active: string; inactive: string; indicator: string }
> = {
  blue: {
    active:
      "bg-blue-500/15 text-blue-400 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.08)]",
    inactive:
      "text-zinc-400 border-transparent hover:text-blue-400 hover:bg-blue-500/8 hover:border-blue-500/20",
    indicator: "bg-blue-400",
  },
  emerald: {
    active:
      "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.08)]",
    inactive:
      "text-zinc-400 border-transparent hover:text-emerald-400 hover:bg-emerald-500/8 hover:border-emerald-500/20",
    indicator: "bg-emerald-400",
  },
  yellow: {
    active:
      "bg-yellow-500/15 text-yellow-400 border-yellow-500/40 shadow-[0_0_12px_rgba(234,179,8,0.08)]",
    inactive:
      "text-zinc-400 border-transparent hover:text-yellow-400 hover:bg-yellow-500/8 hover:border-yellow-500/20",
    indicator: "bg-yellow-400",
  },
  green: {
    active:
      "bg-green-500/15 text-green-400 border-green-500/40 shadow-[0_0_12px_rgba(34,197,94,0.08)]",
    inactive:
      "text-zinc-400 border-transparent hover:text-green-400 hover:bg-green-500/8 hover:border-green-500/20",
    indicator: "bg-green-400",
  },
  cyan: {
    active:
      "bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.08)]",
    inactive:
      "text-zinc-400 border-transparent hover:text-cyan-400 hover:bg-cyan-500/8 hover:border-cyan-500/20",
    indicator: "bg-cyan-400",
  },
  amber: {
    active:
      "bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.08)]",
    inactive:
      "text-zinc-400 border-transparent hover:text-amber-400 hover:bg-amber-500/8 hover:border-amber-500/20",
    indicator: "bg-amber-400",
  },
  purple: {
    active:
      "bg-purple-500/15 text-purple-400 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.08)]",
    inactive:
      "text-zinc-400 border-transparent hover:text-purple-400 hover:bg-purple-500/8 hover:border-purple-500/20",
    indicator: "bg-purple-400",
  },
};
