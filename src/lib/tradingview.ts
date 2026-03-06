import { getBondMeta } from "@/lib/bond-metadata";

/**
 * Map a portfolio ticker + category to a TradingView chart symbol.
 * Returns null for bonds and cash (unsupported by TradingView).
 */
export function getTradingViewSymbol(
  ticker: string,
  category: "stock" | "cedear" | "crypto" | "cash"
): string | null {
  // Bonds are sometimes categorized as "stock" on the explore page,
  // so check bond metadata first.
  if (getBondMeta(ticker)) return null;

  switch (category) {
    case "cedear":
      return `BCBA:${ticker}`;
    case "stock":
      return `BCBA:${ticker}`;
    case "crypto":
      return `BINANCE:${ticker}USDT`;
    case "cash":
      return null;
    default:
      return null;
  }
}
