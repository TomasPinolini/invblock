import { NextResponse } from "next/server";
import { BinanceClient, type BinanceCredentials } from "@/services/binance";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

import type { BrokerPortfolioAsset } from "@/types/portfolio";

// Binance assets extend the broker type with a locked field
interface BinancePortfolioAsset extends BrokerPortfolioAsset {
  locked: number; // Units in open orders
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { connected: false, assets: [] },
        { status: 401 }
      );
    }

    const rateLimited = await checkRateLimit(user.id, "binance-portfolio", RATE_LIMITS.default);
    if (rateLimited) return rateLimited;

    // Get Binance credentials
    const connection = await db
      .select()
      .from(userConnections)
      .where(
        and(
          eq(userConnections.userId, user.id),
          eq(userConnections.provider, "binance")
        )
      )
      .limit(1);

    if (connection.length === 0) {
      return NextResponse.json({ connected: false, assets: [] });
    }

    const credentials: BinanceCredentials = decryptCredentials<BinanceCredentials>(
      connection[0].credentials
    );
    const client = new BinanceClient(credentials);

    // Fetch portfolio from Binance
    const binanceAssets = await client.getPortfolio();

    // Filter out tiny dust balances (less than $1)
    const significantAssets = binanceAssets.filter((a) => a.usdValue >= 1);

    // Map to our format
    const assets: BinancePortfolioAsset[] = significantAssets.map((asset) => ({
      id: `binance-${asset.asset}`,
      ticker: asset.asset,
      name: getCryptoName(asset.asset),
      category: "crypto",
      currency: "USD",
      quantity: asset.total,
      averagePrice: 0, // Binance spot API doesn't provide cost basis
      currentPrice: asset.price,
      currentValue: asset.usdValue,
      pnl: 0, // Can't calculate without cost basis
      pnlPercent: 0,
      locked: asset.locked,
    }));

    // Calculate totals
    const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);

    return NextResponse.json({
      connected: true,
      assets,
      totals: {
        usd: totalValue,
      },
    });
  } catch (error) {
    console.error("Binance portfolio fetch error:", error);

    // Check if it's an auth error
    const errorMsg =
      error instanceof Error ? error.message : "Failed to fetch portfolio";
    if (
      errorMsg.includes("Invalid API") ||
      errorMsg.includes("-2015") ||
      errorMsg.includes("-2014")
    ) {
      return NextResponse.json({
        connected: false,
        expired: true,
        assets: [],
        error: "API keys invalid or expired. Please reconnect.",
      });
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// Common crypto name mapping
function getCryptoName(symbol: string): string {
  const names: Record<string, string> = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    BNB: "Binance Coin",
    SOL: "Solana",
    XRP: "Ripple",
    ADA: "Cardano",
    DOGE: "Dogecoin",
    DOT: "Polkadot",
    MATIC: "Polygon",
    LINK: "Chainlink",
    AVAX: "Avalanche",
    UNI: "Uniswap",
    ATOM: "Cosmos",
    LTC: "Litecoin",
    USDT: "Tether USD",
    USDC: "USD Coin",
    BUSD: "Binance USD",
    DAI: "Dai Stablecoin",
    SHIB: "Shiba Inu",
    ARB: "Arbitrum",
    OP: "Optimism",
    APT: "Aptos",
    NEAR: "NEAR Protocol",
    FIL: "Filecoin",
    ICP: "Internet Computer",
    VET: "VeChain",
    ALGO: "Algorand",
    SAND: "The Sandbox",
    MANA: "Decentraland",
    AXS: "Axie Infinity",
    AAVE: "Aave",
    CRV: "Curve DAO",
    MKR: "Maker",
    SNX: "Synthetix",
    COMP: "Compound",
    SUSHI: "SushiSwap",
    YFI: "yearn.finance",
    "1INCH": "1inch Network",
    ENS: "Ethereum Name Service",
    LDO: "Lido DAO",
    RPL: "Rocket Pool",
    FDUSD: "First Digital USD",
  };

  return names[symbol] || symbol;
}
