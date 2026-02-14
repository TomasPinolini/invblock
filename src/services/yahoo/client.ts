import YahooFinance from "yahoo-finance2";
import { getGlobalQuote } from "@/services/alphavantage";

// Create instance (required in v3+)
const yahooFinance = new YahooFinance();

export type TimePeriod = "1D" | "1W" | "1M" | "1Y" | "5Y" | "ALL";

export interface HistoricalPrice {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

export interface HistoricalResult {
  history: HistoricalPrice[];
  currency: string;
}

// Infer currency from the resolved Yahoo symbol
function inferCurrencyFromSymbol(symbol: string): string {
  if (symbol.endsWith(".BA")) return "ARS";
  if (symbol.endsWith("-USD")) return "USD";
  return "USD"; // US-listed stocks, ADRs
}

export interface QuoteResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  currency: string;
  marketState: string;
}

// Returns an ordered list of Yahoo Finance symbols to try for a given ticker.
// The first symbol that returns data wins. This handles:
// - CEDEARs (US stocks traded on BCBA): try raw US ticker first (AAPL), then .BA
// - Argentine stocks: try .BA first, then raw ticker (catches NYSE ADRs like YPF, GGAL)
// - Crypto: -USD suffix
// - Bonds/ONs/letras: raw ticker (unlikely to have Yahoo data)
export function getYahooSymbols(ticker: string, category: string): string[] {
  if (ticker.includes(".") || ticker.includes("-")) return [ticker];

  if (category === "crypto") {
    return [`${ticker}-USD`];
  }
  if (category === "cedear") {
    // CEDEARs represent US/intl stocks — raw ticker is more reliable
    return [ticker, `${ticker}.BA`];
  }
  if (category === "stock") {
    // Argentine stocks — .BA first, raw ticker as fallback for NYSE ADRs
    return [`${ticker}.BA`, ticker];
  }
  return [ticker];
}

// Convenience: returns the primary symbol (for logging, etc.)
export function toYahooSymbol(ticker: string, category: string): string {
  return getYahooSymbols(ticker, category)[0];
}

// Get period parameters for Yahoo Finance based on time period
function getPeriodParams(period: TimePeriod): { period1: Date; interval: "1d" | "1wk" | "1mo" } {
  const now = new Date();
  let period1: Date;
  let interval: "1d" | "1wk" | "1mo" = "1d";

  switch (period) {
    case "1D":
      period1 = new Date(now);
      period1.setDate(period1.getDate() - 5); // Get 5 days to ensure we have prev close
      interval = "1d";
      break;
    case "1W":
      period1 = new Date(now);
      period1.setDate(period1.getDate() - 10);
      interval = "1d";
      break;
    case "1M":
      period1 = new Date(now);
      period1.setMonth(period1.getMonth() - 1);
      period1.setDate(period1.getDate() - 5);
      interval = "1d";
      break;
    case "1Y":
      period1 = new Date(now);
      period1.setFullYear(period1.getFullYear() - 1);
      period1.setDate(period1.getDate() - 7);
      interval = "1d";
      break;
    case "5Y":
      period1 = new Date(now);
      period1.setFullYear(period1.getFullYear() - 5);
      interval = "1wk";
      break;
    case "ALL":
    default:
      period1 = new Date("2000-01-01");
      interval = "1mo";
      break;
  }

  return { period1, interval };
}

// Get the reference date for a time period (the date to compare against)
function getReferenceDate(period: TimePeriod): Date {
  const now = new Date();

  switch (period) {
    case "1D":
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    case "1W":
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);
      return lastWeek;
    case "1M":
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return lastMonth;
    case "1Y":
      const lastYear = new Date(now);
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      return lastYear;
    case "5Y":
      const fiveYearsAgo = new Date(now);
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      return fiveYearsAgo;
    case "ALL":
    default:
      return new Date("2000-01-01");
  }
}

// Chart quote type for type assertions
type ChartQuote = {
  date: Date;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
  adjclose?: number | null;
};

type ChartResult = {
  quotes?: ChartQuote[];
};

// Fetch historical prices for a ticker — tries multiple Yahoo symbols until one works
export async function getHistoricalPrices(
  ticker: string,
  category: string,
  period: TimePeriod
): Promise<HistoricalResult> {
  const symbols = getYahooSymbols(ticker, category);
  const { period1, interval } = getPeriodParams(period);

  for (const symbol of symbols) {
    try {
      const result = await yahooFinance.chart(symbol, {
        period1,
        interval,
      });

      const chartResult = result as ChartResult;

      if (!chartResult.quotes || chartResult.quotes.length === 0) {
        continue; // Try next symbol
      }

      return {
        history: chartResult.quotes.map((q) => ({
          date: q.date,
          open: q.open ?? 0,
          high: q.high ?? 0,
          low: q.low ?? 0,
          close: q.close ?? 0,
          volume: q.volume ?? 0,
          adjClose: q.adjclose ?? undefined,
        })),
        currency: inferCurrencyFromSymbol(symbol),
      };
    } catch {
      // Try next symbol
    }
  }

  return { history: [], currency: "ARS" };
}

// Quote result type for type assertions
type YahooQuoteResult = {
  symbol: string;
  regularMarketPrice?: number | null;
  regularMarketChange?: number | null;
  regularMarketChangePercent?: number | null;
  regularMarketPreviousClose?: number | null;
  currency?: string;
  marketState?: string;
};

// Get current quote for a ticker — tries multiple Yahoo symbols until one works
export async function getQuote(ticker: string, category: string): Promise<QuoteResult | null> {
  const symbols = getYahooSymbols(ticker, category);

  for (const symbol of symbols) {
    try {
      const result = await yahooFinance.quote(symbol) as YahooQuoteResult;
      if (!result) continue;

      return {
        symbol: result.symbol,
        price: result.regularMarketPrice ?? 0,
        change: result.regularMarketChange ?? 0,
        changePercent: result.regularMarketChangePercent ?? 0,
        previousClose: result.regularMarketPreviousClose ?? 0,
        currency: result.currency ?? "USD",
        marketState: result.marketState ?? "CLOSED",
      };
    } catch {
      // Try next symbol
    }
  }

  // Before returning null, try Alpha Vantage for stocks/CEDEARs
  if (category === "cedear" || category === "stock") {
    try {
      const avQuote = await getGlobalQuote(ticker);
      if (avQuote && avQuote.price > 0) {
        return {
          symbol: avQuote.symbol,
          price: avQuote.price,
          change: avQuote.change,
          changePercent: avQuote.changePercent,
          previousClose: avQuote.previousClose,
          currency: "USD",
          marketState: "CLOSED",
        };
      }
    } catch {
      // Alpha Vantage also failed
    }
  }

  return null;
}

// Get price at a specific time period ago for calculating returns
export async function getPriceAtPeriod(
  ticker: string,
  category: string,
  period: TimePeriod
): Promise<number | null> {
  if (period === "ALL") {
    return null;
  }

  const symbols = getYahooSymbols(ticker, category);
  const referenceDate = getReferenceDate(period);
  const { period1, interval } = getPeriodParams(period);

  for (const symbol of symbols) {
    try {
      const result = await yahooFinance.chart(symbol, {
        period1,
        interval,
      });

      const chartResult = result as ChartResult;

      if (!chartResult.quotes || chartResult.quotes.length === 0) {
        continue;
      }

      const quotes = chartResult.quotes.filter((q) => q.close != null);
      if (quotes.length === 0) continue;

      let closestQuote = quotes[0];
      let closestDiff = Math.abs(quotes[0].date.getTime() - referenceDate.getTime());

      for (const quote of quotes) {
        const diff = Math.abs(quote.date.getTime() - referenceDate.getTime());
        if (diff < closestDiff) {
          closestDiff = diff;
          closestQuote = quote;
        }
      }

      return closestQuote?.close ?? null;
    } catch {
      // Try next symbol
    }
  }

  return null;
}

// Batch fetch prices at a period for multiple tickers
export async function getBatchPricesAtPeriod(
  tickers: Array<{ ticker: string; category: string }>,
  period: TimePeriod
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  // Process in parallel with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const promises = batch.map(async ({ ticker, category }) => {
      const price = await getPriceAtPeriod(ticker, category, period);
      if (price !== null) {
        results.set(ticker, price);
      }
    });
    await Promise.all(promises);
  }

  return results;
}
