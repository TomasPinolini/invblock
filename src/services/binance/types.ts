// Binance API credentials (stored encrypted in DB)
export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
}

// Balance from /api/v3/account
export interface BinanceBalance {
  asset: string; // e.g., "BTC", "ETH", "USDT"
  free: string; // Available balance
  locked: string; // In orders
}

// Account info response
export interface BinanceAccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: BinanceBalance[];
}

// Ticker price response
export interface BinanceTickerPrice {
  symbol: string; // e.g., "BTCUSDT"
  price: string;
}

// Formatted asset for our app
export interface BinanceAsset {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue: number;
  price: number;
}
