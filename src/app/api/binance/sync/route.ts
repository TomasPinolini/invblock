import { NextResponse } from "next/server";
import { BinanceClient, type BinanceCredentials } from "@/services/binance";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials } from "@/lib/crypto";
import { db } from "@/db";
import { userConnections, assets } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { NewAsset } from "@/db/schema";

export async function POST() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(user.id, "binance-sync", RATE_LIMITS.default);
  if (rateLimited) return rateLimited;

  try {
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
      return NextResponse.json(
        { error: "Binance account not connected" },
        { status: 400 }
      );
    }

    const credentials: BinanceCredentials = decryptCredentials<BinanceCredentials>(
      connection[0].credentials
    );
    const client = new BinanceClient(credentials);

    // Fetch portfolio from Binance
    const binanceAssets = await client.getPortfolio();

    // Filter out tiny dust balances (less than $1)
    const significantAssets = binanceAssets.filter((a) => a.usdValue >= 1);

    // Filter stablecoins and build array of assets to upsert
    const STABLECOINS = ["USDT", "USDC", "BUSD", "DAI", "FDUSD"];
    const toUpsert: NewAsset[] = significantAssets
      .filter((item) => !STABLECOINS.includes(item.asset.toUpperCase()))
      .map((item) => ({
        userId: user.id,
        ticker: item.asset.toUpperCase(),
        name: getCryptoName(item.asset.toUpperCase()),
        category: "crypto" as const,
        currency: "USD" as const,
        quantity: item.total.toString(),
        averagePrice: "0", // Binance doesn't provide cost basis
        currentPrice: item.price.toString(),
      }));

    let synced = 0;

    if (toUpsert.length > 0) {
      await db
        .insert(assets)
        .values(toUpsert)
        .onConflictDoUpdate({
          target: [assets.userId, assets.ticker, assets.category],
          set: {
            quantity: sql`excluded.quantity`,
            currentPrice: sql`excluded.current_price`,
            updatedAt: new Date(),
          },
        });
      synced = toUpsert.length;
    }

    return NextResponse.json({
      success: true,
      synced,
      total: significantAssets.length,
    });
  } catch (error) {
    console.error("Binance sync error:", error);

    const errorMsg =
      error instanceof Error ? error.message : "Sync failed";

    // Check if it's an auth error
    if (
      errorMsg.includes("Invalid API") ||
      errorMsg.includes("-2015") ||
      errorMsg.includes("-2014")
    ) {
      return NextResponse.json(
        { error: "API keys invalid or expired", expired: true },
        { status: 401 }
      );
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
  };

  return names[symbol] || symbol;
}
