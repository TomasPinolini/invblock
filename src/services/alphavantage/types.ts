// Alpha Vantage API response types

export interface AVExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  lastRefreshed: string;
  bidPrice: number;
  askPrice: number;
}

export interface AVGlobalQuote {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
  change: number;
  changePercent: number;
  latestTradingDay: string;
}

export interface AVNewsFeed {
  title: string;
  url: string;
  timePublished: string;
  summary: string;
  source: string;
  overallSentimentScore: number;
  overallSentimentLabel: "Bullish" | "Somewhat-Bullish" | "Neutral" | "Somewhat-Bearish" | "Bearish";
  tickerSentiment: Array<{
    ticker: string;
    relevanceScore: number;
    sentimentScore: number;
    sentimentLabel: string;
  }>;
}

export interface AVCompanyOverview {
  symbol: string;
  name: string;
  description: string;
  exchange: string;
  currency: string;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  pegRatio: number;
  eps: number;
  dividendYield: number;
  week52High: number;
  week52Low: number;
  analystTargetPrice: number;
  analystRatingStrongBuy: number;
  analystRatingBuy: number;
  analystRatingHold: number;
  analystRatingSell: number;
  analystRatingStrongSell: number;
  beta: number;
  profitMargin: number;
  revenuePerShare: number;
  quarterlyRevenueGrowthYOY: number;
  quarterlyEarningsGrowthYOY: number;
}

export interface AVTopMover {
  ticker: string;
  price: string;
  changeAmount: string;
  changePercentage: string;
  volume: string;
}

export interface AVTopMoversResponse {
  topGainers: AVTopMover[];
  topLosers: AVTopMover[];
  mostActivelyTraded: AVTopMover[];
}

export interface AVBudgetStatus {
  used: number;
  remaining: number;
  limit: number;
  isWarning: boolean;
  isExhausted: boolean;
}

export interface AVCachedResponse<T> {
  data: T;
  cached: boolean;
  budget: AVBudgetStatus;
}
