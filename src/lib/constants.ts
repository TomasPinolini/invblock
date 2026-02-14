export const ASSET_CATEGORIES = [
  "stock",
  "cedear",
  "crypto",
  "cash",
] as const;

export const CURRENCIES = ["USD", "ARS"] as const;
export const TRANSACTION_TYPES = ["buy", "sell"] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
export type Currency = (typeof CURRENCIES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// Mock prices — replace with real API calls (IOL, Yahoo Finance, Binance)
// This map is the single integration point for future price services.
export const MOCK_PRICES: Record<string, number> = {
  AAPL: 227.5,
  MSFT: 445.2,
  GOOGL: 178.9,
  GGAL: 82.15, // CEDEAR - Galicia
  YPF: 26.4, // CEDEAR - YPF
  MELI: 2085.0, // CEDEAR - MercadoLibre
  BTC: 104250.0,
  ETH: 3420.0,
  SOL: 195.6,
  ARS: 1.0, // Cash balances
  USD: 1.0,
};

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  stock: "Stocks",
  cedear: "CEDEARs",
  crypto: "Crypto",
  cash: "Cash",
};

export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  stock: "#3b82f6", // blue-500
  cedear: "#a855f7", // purple-500
  crypto: "#f59e0b", // amber-500
  cash: "#22c55e", // green-500
};

// ── Watchlist Group Colors ──────────────────────────────────────────────────

export const GROUP_COLORS = [
  "red", "orange", "amber", "yellow", "lime", "green",
  "emerald", "teal", "cyan", "sky", "blue", "indigo",
  "violet", "purple", "fuchsia", "pink", "rose", "zinc",
] as const;

export type GroupColor = (typeof GROUP_COLORS)[number];

export const GROUP_COLOR_MAP: Record<GroupColor, { bg: string; text: string; border: string; dot: string }> = {
  red:     { bg: "bg-red-500/15",     text: "text-red-400",     border: "border-red-500/40",     dot: "bg-red-400" },
  orange:  { bg: "bg-orange-500/15",  text: "text-orange-400",  border: "border-orange-500/40",  dot: "bg-orange-400" },
  amber:   { bg: "bg-amber-500/15",   text: "text-amber-400",   border: "border-amber-500/40",   dot: "bg-amber-400" },
  yellow:  { bg: "bg-yellow-500/15",  text: "text-yellow-400",  border: "border-yellow-500/40",  dot: "bg-yellow-400" },
  lime:    { bg: "bg-lime-500/15",    text: "text-lime-400",    border: "border-lime-500/40",    dot: "bg-lime-400" },
  green:   { bg: "bg-green-500/15",   text: "text-green-400",   border: "border-green-500/40",   dot: "bg-green-400" },
  emerald: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40", dot: "bg-emerald-400" },
  teal:    { bg: "bg-teal-500/15",    text: "text-teal-400",    border: "border-teal-500/40",    dot: "bg-teal-400" },
  cyan:    { bg: "bg-cyan-500/15",    text: "text-cyan-400",    border: "border-cyan-500/40",    dot: "bg-cyan-400" },
  sky:     { bg: "bg-sky-500/15",     text: "text-sky-400",     border: "border-sky-500/40",     dot: "bg-sky-400" },
  blue:    { bg: "bg-blue-500/15",    text: "text-blue-400",    border: "border-blue-500/40",    dot: "bg-blue-400" },
  indigo:  { bg: "bg-indigo-500/15",  text: "text-indigo-400",  border: "border-indigo-500/40",  dot: "bg-indigo-400" },
  violet:  { bg: "bg-violet-500/15",  text: "text-violet-400",  border: "border-violet-500/40",  dot: "bg-violet-400" },
  purple:  { bg: "bg-purple-500/15",  text: "text-purple-400",  border: "border-purple-500/40",  dot: "bg-purple-400" },
  fuchsia: { bg: "bg-fuchsia-500/15", text: "text-fuchsia-400", border: "border-fuchsia-500/40", dot: "bg-fuchsia-400" },
  pink:    { bg: "bg-pink-500/15",    text: "text-pink-400",    border: "border-pink-500/40",    dot: "bg-pink-400" },
  rose:    { bg: "bg-rose-500/15",    text: "text-rose-400",    border: "border-rose-500/40",    dot: "bg-rose-400" },
  zinc:    { bg: "bg-zinc-500/15",    text: "text-zinc-400",    border: "border-zinc-500/40",    dot: "bg-zinc-400" },
};
