import type {
  AVExchangeRate,
  AVGlobalQuote,
  AVNewsFeed,
  AVCompanyOverview,
  AVTopMoversResponse,
  AVBudgetStatus,
} from "./types";

// ── Configuration ────────────────────────────────────────────────────────

const API_KEY = process.env.ALPHAVANTAGE_API_KEY ?? "";
const BASE_URL = "https://www.alphavantage.co/query";
const DAILY_LIMIT = 25;
const EMERGENCY_RESERVE = 1; // Reserve 1 call for critical operations

// ── Cache ────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// TTLs in milliseconds
const TTL = {
  exchangeRate: 30 * 60 * 1000,  // 30 min
  quote: 5 * 60 * 1000,          // 5 min
  news: 2 * 60 * 60 * 1000,      // 2 hours
  company: 24 * 60 * 60 * 1000,  // 24 hours
  movers: 30 * 60 * 1000,        // 30 min
} as const;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// ── Daily Budget Tracker ─────────────────────────────────────────────────

let dailyCounter = 0;
let counterResetDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

function checkAndIncrementBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== counterResetDate) {
    dailyCounter = 0;
    counterResetDate = today;
  }
  if (dailyCounter >= DAILY_LIMIT - EMERGENCY_RESERVE) {
    return false;
  }
  dailyCounter++;
  return true;
}

export function getDailyBudgetStatus(): AVBudgetStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== counterResetDate) {
    dailyCounter = 0;
    counterResetDate = today;
  }
  const remaining = Math.max(0, DAILY_LIMIT - dailyCounter);
  return {
    used: dailyCounter,
    remaining,
    limit: DAILY_LIMIT,
    isWarning: remaining <= 5,
    isExhausted: remaining <= EMERGENCY_RESERVE,
  };
}

// ── Core fetch helper ────────────────────────────────────────────────────

async function avFetch(params: Record<string, string>): Promise<unknown> {
  if (!API_KEY) {
    throw new Error("ALPHAVANTAGE_API_KEY not configured");
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("apikey", API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Alpha Vantage API error: ${res.status}`);
  }

  const data = await res.json();

  // Alpha Vantage returns error messages in the response body
  if (data["Error Message"]) {
    throw new Error(data["Error Message"]);
  }
  if (data["Note"]) {
    // Rate limit hit
    throw new Error("Alpha Vantage rate limit reached");
  }
  if (data["Information"]) {
    throw new Error(data["Information"]);
  }

  return data;
}

// ── Public Functions ─────────────────────────────────────────────────────

/**
 * Get exchange rate between two currencies (e.g., USD → ARS).
 * TTL: 30 minutes.
 */
export async function getExchangeRate(
  from: string,
  to: string
): Promise<AVExchangeRate | null> {
  const cacheKey = `av-fx-${from}-${to}`;
  const cached = getCached<AVExchangeRate>(cacheKey);
  if (cached) return cached;

  if (!checkAndIncrementBudget()) return null;

  try {
    const data = await avFetch({
      function: "CURRENCY_EXCHANGE_RATE",
      from_currency: from,
      to_currency: to,
    });

    const raw = (data as Record<string, Record<string, string>>)[
      "Realtime Currency Exchange Rate"
    ];
    if (!raw) return null;

    const result: AVExchangeRate = {
      fromCurrency: raw["1. From_Currency Code"] || from,
      toCurrency: raw["3. To_Currency Code"] || to,
      rate: parseFloat(raw["5. Exchange Rate"]) || 0,
      lastRefreshed: raw["6. Last Refreshed"] || "",
      bidPrice: parseFloat(raw["8. Bid Price"]) || 0,
      askPrice: parseFloat(raw["9. Ask Price"]) || 0,
    };

    if (result.rate > 0) {
      setCache(cacheKey, result, TTL.exchangeRate);
    }
    return result;
  } catch (error) {
    console.error("[Alpha Vantage] Exchange rate error:", error);
    return null;
  }
}

/**
 * Get global quote for a US stock symbol.
 * TTL: 5 minutes. Used as fallback when Yahoo fails.
 */
export async function getGlobalQuote(
  symbol: string
): Promise<AVGlobalQuote | null> {
  const cacheKey = `av-quote-${symbol}`;
  const cached = getCached<AVGlobalQuote>(cacheKey);
  if (cached) return cached;

  if (!checkAndIncrementBudget()) return null;

  try {
    const data = await avFetch({
      function: "GLOBAL_QUOTE",
      symbol,
    });

    const raw = (data as Record<string, Record<string, string>>)[
      "Global Quote"
    ];
    if (!raw || !raw["05. price"]) return null;

    const result: AVGlobalQuote = {
      symbol: raw["01. symbol"] || symbol,
      open: parseFloat(raw["02. open"]) || 0,
      high: parseFloat(raw["03. high"]) || 0,
      low: parseFloat(raw["04. low"]) || 0,
      price: parseFloat(raw["05. price"]) || 0,
      volume: parseInt(raw["06. volume"]) || 0,
      latestTradingDay: raw["07. latest trading day"] || "",
      previousClose: parseFloat(raw["08. previous close"]) || 0,
      change: parseFloat(raw["09. change"]) || 0,
      changePercent: parseFloat((raw["10. change percent"] || "0").replace("%", "")) || 0,
    };

    if (result.price > 0) {
      setCache(cacheKey, result, TTL.quote);
    }
    return result;
  } catch (error) {
    console.error("[Alpha Vantage] Quote error:", error);
    return null;
  }
}

/**
 * Get news with sentiment analysis.
 * TTL: 2 hours.
 */
export async function getNewsSentiment(
  tickers?: string[],
  limit = 10
): Promise<AVNewsFeed[]> {
  const tickerKey = tickers?.sort().join(",") || "general";
  const cacheKey = `av-news-${tickerKey}-${limit}`;
  const cached = getCached<AVNewsFeed[]>(cacheKey);
  if (cached) return cached;

  if (!checkAndIncrementBudget()) return [];

  try {
    const params: Record<string, string> = {
      function: "NEWS_SENTIMENT",
      limit: String(limit),
      sort: "RELEVANCE",
    };
    if (tickers?.length) {
      params.tickers = tickers.join(",");
    }

    const data = await avFetch(params);
    const feed = (data as Record<string, unknown>)["feed"];
    if (!Array.isArray(feed)) return [];

    const results: AVNewsFeed[] = feed.slice(0, limit).map((item: Record<string, unknown>) => ({
      title: String(item.title || ""),
      url: String(item.url || ""),
      timePublished: String(item.time_published || ""),
      summary: String(item.summary || ""),
      source: String(item.source || ""),
      overallSentimentScore: Number(item.overall_sentiment_score) || 0,
      overallSentimentLabel: mapSentimentLabel(
        String(item.overall_sentiment_label || "Neutral")
      ),
      tickerSentiment: Array.isArray(item.ticker_sentiment)
        ? (item.ticker_sentiment as Record<string, unknown>[]).map((ts) => ({
            ticker: String(ts.ticker || ""),
            relevanceScore: Number(ts.relevance_score) || 0,
            sentimentScore: Number(ts.ticker_sentiment_score) || 0,
            sentimentLabel: String(ts.ticker_sentiment_label || "Neutral"),
          }))
        : [],
    }));

    if (results.length > 0) {
      setCache(cacheKey, results, TTL.news);
    }
    return results;
  } catch (error) {
    console.error("[Alpha Vantage] News error:", error);
    return [];
  }
}

function mapSentimentLabel(
  label: string
): AVNewsFeed["overallSentimentLabel"] {
  const map: Record<string, AVNewsFeed["overallSentimentLabel"]> = {
    Bullish: "Bullish",
    "Somewhat-Bullish": "Somewhat-Bullish",
    "Somewhat_Bullish": "Somewhat-Bullish",
    Neutral: "Neutral",
    "Somewhat-Bearish": "Somewhat-Bearish",
    "Somewhat_Bearish": "Somewhat-Bearish",
    Bearish: "Bearish",
  };
  return map[label] || "Neutral";
}

/**
 * Get company fundamentals.
 * TTL: 24 hours.
 */
export async function getCompanyOverview(
  symbol: string
): Promise<AVCompanyOverview | null> {
  const cacheKey = `av-company-${symbol}`;
  const cached = getCached<AVCompanyOverview>(cacheKey);
  if (cached) return cached;

  if (!checkAndIncrementBudget()) return null;

  try {
    const data = (await avFetch({
      function: "OVERVIEW",
      symbol,
    })) as Record<string, string>;

    if (!data.Symbol) return null;

    const result: AVCompanyOverview = {
      symbol: data.Symbol,
      name: data.Name || "",
      description: data.Description || "",
      exchange: data.Exchange || "",
      currency: data.Currency || "USD",
      sector: data.Sector || "",
      industry: data.Industry || "",
      marketCap: parseInt(data.MarketCapitalization) || 0,
      peRatio: parseFloat(data.PERatio) || 0,
      pegRatio: parseFloat(data.PEGRatio) || 0,
      eps: parseFloat(data.EPS) || 0,
      dividendYield: parseFloat(data.DividendYield) || 0,
      week52High: parseFloat(data["52WeekHigh"]) || 0,
      week52Low: parseFloat(data["52WeekLow"]) || 0,
      analystTargetPrice: parseFloat(data.AnalystTargetPrice) || 0,
      analystRatingStrongBuy: parseInt(data.AnalystRatingStrongBuy) || 0,
      analystRatingBuy: parseInt(data.AnalystRatingBuy) || 0,
      analystRatingHold: parseInt(data.AnalystRatingHold) || 0,
      analystRatingSell: parseInt(data.AnalystRatingSell) || 0,
      analystRatingStrongSell: parseInt(data.AnalystRatingStrongSell) || 0,
      beta: parseFloat(data.Beta) || 0,
      profitMargin: parseFloat(data.ProfitMargin) || 0,
      revenuePerShare: parseFloat(data.RevenuePerShareTTM) || 0,
      quarterlyRevenueGrowthYOY: parseFloat(data.QuarterlyRevenueGrowthYOY) || 0,
      quarterlyEarningsGrowthYOY: parseFloat(data.QuarterlyEarningsGrowthYOY) || 0,
    };

    setCache(cacheKey, result, TTL.company);
    return result;
  } catch (error) {
    console.error("[Alpha Vantage] Company overview error:", error);
    return null;
  }
}

/**
 * Get top gainers, losers, and most actively traded.
 * TTL: 30 minutes.
 */
export async function getTopMovers(): Promise<AVTopMoversResponse | null> {
  const cacheKey = "av-movers";
  const cached = getCached<AVTopMoversResponse>(cacheKey);
  if (cached) return cached;

  if (!checkAndIncrementBudget()) return null;

  try {
    const data = (await avFetch({
      function: "TOP_GAINERS_LOSERS",
    })) as Record<string, unknown>;

    const mapMover = (item: Record<string, string>) => ({
      ticker: item.ticker || "",
      price: item.price || "0",
      changeAmount: item.change_amount || "0",
      changePercentage: item.change_percentage || "0%",
      volume: item.volume || "0",
    });

    const result: AVTopMoversResponse = {
      topGainers: Array.isArray(data.top_gainers)
        ? (data.top_gainers as Record<string, string>[]).slice(0, 10).map(mapMover)
        : [],
      topLosers: Array.isArray(data.top_losers)
        ? (data.top_losers as Record<string, string>[]).slice(0, 10).map(mapMover)
        : [],
      mostActivelyTraded: Array.isArray(data.most_actively_traded)
        ? (data.most_actively_traded as Record<string, string>[]).slice(0, 10).map(mapMover)
        : [],
    };

    if (result.topGainers.length > 0) {
      setCache(cacheKey, result, TTL.movers);
    }
    return result;
  } catch (error) {
    console.error("[Alpha Vantage] Top movers error:", error);
    return null;
  }
}
