import { NextResponse } from "next/server";
import { BinanceClient, type BinanceCredentials } from "@/services/binance";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db";
import { userConnections, assets } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    const credentials: BinanceCredentials = JSON.parse(
      connection[0].credentials
    );
    const client = new BinanceClient(credentials);

    // Fetch portfolio from Binance
    const binanceAssets = await client.getPortfolio();

    // Filter out tiny dust balances (less than $1)
    const significantAssets = binanceAssets.filter((a) => a.usdValue >= 1);

    console.log("[Binance Sync] Assets found:", significantAssets.length);

    // Get existing assets for this user
    const existingAssets = await db.query.assets.findMany({
      where: eq(assets.userId, user.id),
    });

    const existingByTicker = new Map(
      existingAssets.map((a) => [a.ticker.toUpperCase(), a])
    );

    let created = 0;
    let updated = 0;

    for (const item of significantAssets) {
      const ticker = item.asset.toUpperCase();

      // Skip stablecoins - they're essentially cash
      if (["USDT", "USDC", "BUSD", "DAI", "FDUSD"].includes(ticker)) {
        continue;
      }

      console.log("[Binance Sync] Processing:", ticker, "qty:", item.total);

      const existing = existingByTicker.get(ticker);

      if (existing) {
        // Update existing asset
        await db
          .update(assets)
          .set({
            quantity: item.total.toString(),
            currentPrice: item.price.toString(),
            updatedAt: new Date(),
          })
          .where(eq(assets.id, existing.id));
        updated++;
      } else {
        // Create new asset
        await db.insert(assets).values({
          userId: user.id,
          ticker,
          name: getCryptoName(ticker),
          category: "crypto",
          currency: "USD",
          quantity: item.total.toString(),
          averagePrice: "0", // Binance doesn't provide cost basis
          currentPrice: item.price.toString(),
        });
        created++;
      }
    }

    console.log("[Binance Sync] Done. Created:", created, "Updated:", updated);

    return NextResponse.json({
      success: true,
      created,
      updated,
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
