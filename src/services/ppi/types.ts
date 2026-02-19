// PPI (Portfolio Personal Inversiones) API Types
// NOTE: Response shapes are tentative — based on API docs + Python SDK analysis.
// Will need adjustment once sandbox credentials are available.

export interface PPICredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  refreshToken: string;
}

export interface PPILoginResponse {
  accessToken: string;
  refreshToken: string;
  creationDate: string;
  expirationDate: string;
}

export interface PPIPosition {
  Ticker: string;
  Description: string;
  Currency: string; // "ARS" | "USD"
  Price: number;
  Quantity: number;
  Amount: number; // Current value
  AveragePrice: number;
  PnL: number; // P&L in money
  PnLPercentage: number; // P&L percentage
  InstrumentType: string; // "ACCIONES" | "CEDEARS" | "BONOS" | "LETRAS" | "ETF" | "ON"
  Market: string; // "BYMA" | "NYSE" | "ROFEX" | "OTC"
  Settlement: string; // "INMEDIATA" | "A-24HS" | "A-48HS" | "A-72HS"
}

export interface PPIBalance {
  Currency: string;
  Settlement: string;
  Amount: number;
  Available: number;
  Committed: number;
}

export interface PPIBalancesAndPositions {
  Positions: PPIPosition[];
  CashBalances: PPIBalance[];
}

export interface PPIAvailableBalance {
  Balances: PPIBalance[];
}

export interface PPIQuote {
  Ticker: string;
  Last: number;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  Change: number; // Daily change %
  Date: string;
  Bid: number;
  Ask: number;
}

export interface PPIHistoricalPrice {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

export interface PPIInstrument {
  Ticker: string;
  Description: string;
  Currency: string;
  Market: string;
  Type: string;
}

export interface PPIAccount {
  AccountNumber: string;
  AccountType: string;
  Currency: string;
}
