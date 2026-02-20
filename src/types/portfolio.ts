/**
 * Canonical portfolio asset type used across the entire application.
 *
 * This is the single source of truth for portfolio position data.
 * All API routes, hooks, and components should import from here
 * instead of defining their own versions.
 *
 * Fields marked optional are only populated by certain providers
 * or computed in specific contexts.
 */
export interface PortfolioAsset {
  /** Unique identifier (e.g. ticker symbol or "binance-BTC", "ppi-GGAL") */
  id?: string;
  /** Ticker symbol (e.g. "GGAL", "BTC", "AAPL") */
  ticker: string;
  /** Human-readable name (e.g. "Grupo Galicia", "Bitcoin") */
  name?: string;
  /** Asset category */
  category?: string;
  /** Currency denomination */
  currency?: string;
  /** Number of units held */
  quantity: number;
  /** Average purchase price per unit */
  averagePrice?: number;
  /** Current market price per unit */
  currentPrice?: number;
  /** Total current market value (quantity * currentPrice) */
  currentValue: number;
  /** Unrealized profit/loss in currency units */
  pnl?: number;
  /** Unrealized profit/loss as a percentage */
  pnlPercent?: number;
  /** Position weight as percentage of total portfolio */
  allocation?: number;
  /** Units locked in open orders (Binance-specific) */
  locked?: number;
}

/**
 * Narrower variant used by broker API routes (IOL, PPI) where all
 * fields are guaranteed present in the response.
 */
export interface BrokerPortfolioAsset extends PortfolioAsset {
  id: string;
  name: string;
  category: "stock" | "cedear" | "crypto" | "cash";
  currency: "USD" | "ARS";
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}
