import crypto from "crypto";
import type {
  BinanceCredentials,
  BinanceAccountInfo,
  BinanceTickerPrice,
  BinanceAsset,
} from "./types";

const BINANCE_API_BASE = "https://api.binance.com";

// Stablecoins and fiat - value is 1:1 with USD
const STABLECOINS = new Set(["USDT", "USDC", "BUSD", "DAI", "TUSD", "FDUSD"]);

export class BinanceClient {
  private apiKey: string;
  private apiSecret: string;

  constructor(credentials: BinanceCredentials) {
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
  }

  /**
   * Generate HMAC SHA256 signature for Binance API
   */
  private sign(queryString: string): string {
    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(queryString)
      .digest("hex");
  }

  /**
   * Make authenticated request to Binance API
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<T> {
    const timestamp = Date.now();
    const queryParams = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ),
      timestamp: String(timestamp),
    });

    const signature = this.sign(queryParams.toString());
    queryParams.append("signature", signature);

    const url = `${BINANCE_API_BASE}${endpoint}?${queryParams.toString()}`;

    const response = await fetch(url, {
      headers: {
        "X-MBX-APIKEY": this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.msg || `Binance API error: ${response.status}`
      );
    }

    return response.json();
  }

  /**
   * Make public request (no auth needed)
   */
  private async publicRequest<T>(endpoint: string): Promise<T> {
    const url = `${BINANCE_API_BASE}${endpoint}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Test API connection and credentials
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request<BinanceAccountInfo>("/api/v3/account");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get account balances
   */
  async getAccount(): Promise<BinanceAccountInfo> {
    return this.request<BinanceAccountInfo>("/api/v3/account");
  }

  /**
   * Get all ticker prices
   */
  async getAllPrices(): Promise<BinanceTickerPrice[]> {
    return this.publicRequest<BinanceTickerPrice[]>("/api/v3/ticker/price");
  }

  /**
   * Get portfolio with USD values
   * Returns only assets with balance > 0
   */
  async getPortfolio(): Promise<BinanceAsset[]> {
    // Fetch account and prices in parallel
    const [account, allPrices] = await Promise.all([
      this.getAccount(),
      this.getAllPrices(),
    ]);

    // Build price lookup map (symbol -> price in USDT)
    const priceMap = new Map<string, number>();
    for (const ticker of allPrices) {
      if (ticker.symbol.endsWith("USDT")) {
        const asset = ticker.symbol.replace("USDT", "");
        priceMap.set(asset, parseFloat(ticker.price));
      }
    }

    // USDT itself is 1:1
    priceMap.set("USDT", 1);

    // Process balances
    const assets: BinanceAsset[] = [];

    for (const balance of account.balances) {
      const free = parseFloat(balance.free);
      const locked = parseFloat(balance.locked);
      const total = free + locked;

      // Skip zero balances
      if (total <= 0) continue;

      // Get USD price
      let price = priceMap.get(balance.asset) || 0;

      // Handle stablecoins (assume 1:1 with USD)
      if (STABLECOINS.has(balance.asset)) {
        price = 1;
      }

      const usdValue = total * price;

      assets.push({
        asset: balance.asset,
        free,
        locked,
        total,
        price,
        usdValue,
      });
    }

    // Sort by USD value descending
    assets.sort((a, b) => b.usdValue - a.usdValue);

    return assets;
  }
}
