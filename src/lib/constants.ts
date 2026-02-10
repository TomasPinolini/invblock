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
