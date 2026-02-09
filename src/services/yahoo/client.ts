import YahooFinance from "yahoo-finance2";

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

export interface QuoteResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  currency: string;
  marketState: string;
}

// Map our tickers to Yahoo Finance symbols
// CEDEARs trade on BCBA (Buenos Aires) with .BA suffix
// Argentine stocks also use .BA
// Crypto uses -USD suffix
export function toYahooSymbol(ticker: string, category: string): string {
  if (category === "crypto") {
    // BTC -> BTC-USD, ETH -> ETH-USD, etc.
    return ticker.includes("-") ? ticker : `${ticker}-USD`;
  }
  if (category === "cedear" || category === "stock") {
    // For Argentine market, add .BA suffix if not present
    // Some CEDEARs might need mapping (e.g., AAPL.BA for Apple CEDEAR)
    return ticker.includes(".") ? ticker : `${ticker}.BA`;
  }
  return ticker;
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

// Fetch historical prices for a ticker
export async function getHistoricalPrices(
  ticker: string,
  category: string,
  period: TimePeriod
): Promise<HistoricalPrice[]> {
  const symbol = toYahooSymbol(ticker, category);
  const { period1, interval } = getPeriodParams(period);

  try {
    const result = await yahooFinance.chart(symbol, {
      period1,
      interval,
    });

    // Type assertion for the chart result
    const chartResult = result as ChartResult;

    if (!chartResult.quotes || chartResult.quotes.length === 0) {
      return [];
    }

    return chartResult.quotes.map((q) => ({
      date: q.date,
      open: q.open ?? 0,
      high: q.high ?? 0,
      low: q.low ?? 0,
      close: q.close ?? 0,
      volume: q.volume ?? 0,
      adjClose: q.adjclose ?? undefined,
    }));
  } catch (error) {
    console.error(`Failed to fetch historical prices for ${symbol}:`, error);
    return [];
  }
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

// Get current quote for a ticker
export async function getQuote(ticker: string, category: string): Promise<QuoteResult | null> {
  const symbol = toYahooSymbol(ticker, category);

  try {
    const result = await yahooFinance.quote(symbol) as YahooQuoteResult;

    return {
      symbol: result.symbol,
      price: result.regularMarketPrice ?? 0,
      change: result.regularMarketChange ?? 0,
      changePercent: result.regularMarketChangePercent ?? 0,
      previousClose: result.regularMarketPreviousClose ?? 0,
      currency: result.currency ?? "USD",
      marketState: result.marketState ?? "CLOSED",
    };
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    return null;
  }
}

// Get price at a specific time period ago for calculating returns
export async function getPriceAtPeriod(
  ticker: string,
  category: string,
  period: TimePeriod
): Promise<number | null> {
  if (period === "ALL") {
    // For ALL, we use the average purchase price (handled elsewhere)
    return null;
  }

  const symbol = toYahooSymbol(ticker, category);
  const referenceDate = getReferenceDate(period);
  const { period1, interval } = getPeriodParams(period);

  try {
    const result = await yahooFinance.chart(symbol, {
      period1,
      interval,
    });

    // Type assertion for the chart result
    const chartResult = result as ChartResult;

    if (!chartResult.quotes || chartResult.quotes.length === 0) {
      return null;
    }

    // Find the closest price to our reference date
    const quotes = chartResult.quotes.filter((q) => q.close != null);

    if (quotes.length === 0) {
      return null;
    }

    // Find quote closest to reference date
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
  } catch (error) {
    console.error(`Failed to fetch price at period for ${symbol}:`, error);
    return null;
  }
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
