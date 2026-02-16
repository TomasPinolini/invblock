/**
 * Sector, industry, country, and correlation group metadata for portfolio analysis.
 * Used by the correlation/concentration analysis feature.
 *
 * correlationGroup identifies tickers that tend to move together.
 */

export interface TickerMeta {
  sector: string;
  industry: string;
  country: string;
  correlationGroup: string;
}

const META: Record<string, TickerMeta> = {
  // ── Mega-cap Tech ──
  AAPL: { sector: "Technology", industry: "Consumer Electronics", country: "US", correlationGroup: "us-megacap-tech" },
  MSFT: { sector: "Technology", industry: "Software", country: "US", correlationGroup: "us-megacap-tech" },
  GOOGL: { sector: "Technology", industry: "Internet/Advertising", country: "US", correlationGroup: "us-megacap-tech" },
  GOOG: { sector: "Technology", industry: "Internet/Advertising", country: "US", correlationGroup: "us-megacap-tech" },
  AMZN: { sector: "Technology", industry: "E-Commerce/Cloud", country: "US", correlationGroup: "us-megacap-tech" },
  META: { sector: "Technology", industry: "Social Media", country: "US", correlationGroup: "us-megacap-tech" },
  NVDA: { sector: "Technology", industry: "Semiconductors", country: "US", correlationGroup: "us-semiconductors" },
  TSLA: { sector: "Technology", industry: "Electric Vehicles", country: "US", correlationGroup: "us-ev" },

  // ── Semiconductors ──
  AVGO: { sector: "Technology", industry: "Semiconductors", country: "US", correlationGroup: "us-semiconductors" },
  TSM: { sector: "Technology", industry: "Semiconductors", country: "Taiwan", correlationGroup: "us-semiconductors" },
  ASML: { sector: "Technology", industry: "Semiconductor Equipment", country: "Netherlands", correlationGroup: "us-semiconductors" },
  AMD: { sector: "Technology", industry: "Semiconductors", country: "US", correlationGroup: "us-semiconductors" },
  INTC: { sector: "Technology", industry: "Semiconductors", country: "US", correlationGroup: "us-semiconductors" },
  QCOM: { sector: "Technology", industry: "Semiconductors", country: "US", correlationGroup: "us-semiconductors" },
  TXN: { sector: "Technology", industry: "Semiconductors", country: "US", correlationGroup: "us-semiconductors" },
  MU: { sector: "Technology", industry: "Semiconductors", country: "US", correlationGroup: "us-semiconductors" },
  AMAT: { sector: "Technology", industry: "Semiconductor Equipment", country: "US", correlationGroup: "us-semiconductors" },
  LRCX: { sector: "Technology", industry: "Semiconductor Equipment", country: "US", correlationGroup: "us-semiconductors" },
  KLAC: { sector: "Technology", industry: "Semiconductor Equipment", country: "US", correlationGroup: "us-semiconductors" },
  ENTG: { sector: "Technology", industry: "Semiconductor Equipment", country: "US", correlationGroup: "us-semiconductors" },
  MRVL: { sector: "Technology", industry: "Semiconductors", country: "US", correlationGroup: "us-semiconductors" },
  ON: { sector: "Technology", industry: "Semiconductors", country: "US", correlationGroup: "us-semiconductors" },
  ADI: { sector: "Technology", industry: "Semiconductors", country: "US", correlationGroup: "us-semiconductors" },
  NXPI: { sector: "Technology", industry: "Semiconductors", country: "Netherlands", correlationGroup: "us-semiconductors" },
  ARM: { sector: "Technology", industry: "Semiconductors", country: "UK", correlationGroup: "us-semiconductors" },

  // ── Software & Cloud ──
  CRM: { sector: "Technology", industry: "Software", country: "US", correlationGroup: "us-saas" },
  ORCL: { sector: "Technology", industry: "Software", country: "US", correlationGroup: "us-saas" },
  NOW: { sector: "Technology", industry: "Software", country: "US", correlationGroup: "us-saas" },
  ADBE: { sector: "Technology", industry: "Software", country: "US", correlationGroup: "us-saas" },
  INTU: { sector: "Technology", industry: "Software", country: "US", correlationGroup: "us-saas" },
  SNOW: { sector: "Technology", industry: "Cloud/Data", country: "US", correlationGroup: "us-saas" },
  PLTR: { sector: "Technology", industry: "Software/AI", country: "US", correlationGroup: "us-saas" },
  SHOP: { sector: "Technology", industry: "E-Commerce Platform", country: "Canada", correlationGroup: "us-saas" },
  NET: { sector: "Technology", industry: "Cloud Infrastructure", country: "US", correlationGroup: "us-saas" },
  PANW: { sector: "Technology", industry: "Cybersecurity", country: "US", correlationGroup: "us-cybersecurity" },
  CRWD: { sector: "Technology", industry: "Cybersecurity", country: "US", correlationGroup: "us-cybersecurity" },
  ZS: { sector: "Technology", industry: "Cybersecurity", country: "US", correlationGroup: "us-cybersecurity" },
  DDOG: { sector: "Technology", industry: "Cloud/Observability", country: "US", correlationGroup: "us-saas" },
  MDB: { sector: "Technology", industry: "Database", country: "US", correlationGroup: "us-saas" },
  TEAM: { sector: "Technology", industry: "Software", country: "Australia", correlationGroup: "us-saas" },
  HUBS: { sector: "Technology", industry: "Software/CRM", country: "US", correlationGroup: "us-saas" },
  WDAY: { sector: "Technology", industry: "Software/HR", country: "US", correlationGroup: "us-saas" },
  VEEV: { sector: "Technology", industry: "Software/Healthcare", country: "US", correlationGroup: "us-saas" },
  TTD: { sector: "Technology", industry: "Ad Tech", country: "US", correlationGroup: "us-saas" },
  U: { sector: "Technology", industry: "Gaming/Software", country: "US", correlationGroup: "us-saas" },
  TWLO: { sector: "Technology", industry: "Cloud Communications", country: "US", correlationGroup: "us-saas" },
  OKTA: { sector: "Technology", industry: "Identity/Security", country: "US", correlationGroup: "us-cybersecurity" },

  // ── Internet & Digital ──
  NFLX: { sector: "Communication Services", industry: "Streaming", country: "US", correlationGroup: "us-digital-media" },
  SPOT: { sector: "Communication Services", industry: "Streaming", country: "Sweden", correlationGroup: "us-digital-media" },
  UBER: { sector: "Technology", industry: "Ride-Sharing", country: "US", correlationGroup: "us-digital-platforms" },
  ABNB: { sector: "Technology", industry: "Travel/Platform", country: "US", correlationGroup: "us-digital-platforms" },
  SNAP: { sector: "Communication Services", industry: "Social Media", country: "US", correlationGroup: "us-digital-media" },
  PINS: { sector: "Communication Services", industry: "Social Media", country: "US", correlationGroup: "us-digital-media" },
  SQ: { sector: "Financials", industry: "Fintech", country: "US", correlationGroup: "us-fintech" },
  PYPL: { sector: "Financials", industry: "Fintech", country: "US", correlationGroup: "us-fintech" },
  COIN: { sector: "Financials", industry: "Crypto Exchange", country: "US", correlationGroup: "crypto-adjacent" },
  RBLX: { sector: "Communication Services", industry: "Gaming", country: "US", correlationGroup: "us-digital-media" },
  DASH: { sector: "Technology", industry: "Food Delivery", country: "US", correlationGroup: "us-digital-platforms" },

  // ── LatAm ──
  MELI: { sector: "Technology", industry: "E-Commerce/Fintech", country: "Argentina", correlationGroup: "latam-tech" },
  GLOB: { sector: "Technology", industry: "IT Services", country: "Argentina", correlationGroup: "latam-tech" },
  DESP: { sector: "Technology", industry: "Travel/OTA", country: "Argentina", correlationGroup: "latam-tech" },
  NU: { sector: "Financials", industry: "Fintech", country: "Brazil", correlationGroup: "latam-financials" },
  STNE: { sector: "Financials", industry: "Fintech", country: "Brazil", correlationGroup: "latam-financials" },
  PBR: { sector: "Energy", industry: "Oil & Gas", country: "Brazil", correlationGroup: "latam-energy" },
  VALE: { sector: "Materials", industry: "Mining", country: "Brazil", correlationGroup: "latam-materials" },
  BBD: { sector: "Financials", industry: "Banking", country: "Brazil", correlationGroup: "latam-financials" },
  ITUB: { sector: "Financials", industry: "Banking", country: "Brazil", correlationGroup: "latam-financials" },

  // ── China / Asia ──
  BABA: { sector: "Technology", industry: "E-Commerce", country: "China", correlationGroup: "china-tech" },
  JD: { sector: "Technology", industry: "E-Commerce", country: "China", correlationGroup: "china-tech" },
  PDD: { sector: "Technology", industry: "E-Commerce", country: "China", correlationGroup: "china-tech" },
  BIDU: { sector: "Technology", industry: "Internet/Search", country: "China", correlationGroup: "china-tech" },
  NIO: { sector: "Consumer Discretionary", industry: "Electric Vehicles", country: "China", correlationGroup: "china-ev" },
  LI: { sector: "Consumer Discretionary", industry: "Electric Vehicles", country: "China", correlationGroup: "china-ev" },
  XPEV: { sector: "Consumer Discretionary", industry: "Electric Vehicles", country: "China", correlationGroup: "china-ev" },

  // ── US Financials ──
  JPM: { sector: "Financials", industry: "Banking", country: "US", correlationGroup: "us-banks" },
  V: { sector: "Financials", industry: "Payments", country: "US", correlationGroup: "us-payments" },
  MA: { sector: "Financials", industry: "Payments", country: "US", correlationGroup: "us-payments" },
  GS: { sector: "Financials", industry: "Investment Banking", country: "US", correlationGroup: "us-banks" },
  MS: { sector: "Financials", industry: "Investment Banking", country: "US", correlationGroup: "us-banks" },
  BAC: { sector: "Financials", industry: "Banking", country: "US", correlationGroup: "us-banks" },
  C: { sector: "Financials", industry: "Banking", country: "US", correlationGroup: "us-banks" },
  WFC: { sector: "Financials", industry: "Banking", country: "US", correlationGroup: "us-banks" },
  SCHW: { sector: "Financials", industry: "Brokerage", country: "US", correlationGroup: "us-banks" },
  BLK: { sector: "Financials", industry: "Asset Management", country: "US", correlationGroup: "us-banks" },
  AXP: { sector: "Financials", industry: "Payments/Credit", country: "US", correlationGroup: "us-payments" },
  "BRK.B": { sector: "Financials", industry: "Conglomerate", country: "US", correlationGroup: "us-diversified" },

  // ── Healthcare & Pharma ──
  UNH: { sector: "Healthcare", industry: "Insurance", country: "US", correlationGroup: "us-healthcare" },
  JNJ: { sector: "Healthcare", industry: "Pharma/MedDev", country: "US", correlationGroup: "us-pharma" },
  PFE: { sector: "Healthcare", industry: "Pharma", country: "US", correlationGroup: "us-pharma" },
  ABBV: { sector: "Healthcare", industry: "Pharma", country: "US", correlationGroup: "us-pharma" },
  LLY: { sector: "Healthcare", industry: "Pharma", country: "US", correlationGroup: "us-pharma" },
  MRK: { sector: "Healthcare", industry: "Pharma", country: "US", correlationGroup: "us-pharma" },
  TMO: { sector: "Healthcare", industry: "Life Sciences", country: "US", correlationGroup: "us-healthcare" },
  ABT: { sector: "Healthcare", industry: "MedDev/Diagnostics", country: "US", correlationGroup: "us-healthcare" },
  BMY: { sector: "Healthcare", industry: "Pharma", country: "US", correlationGroup: "us-pharma" },
  AMGN: { sector: "Healthcare", industry: "Biotech", country: "US", correlationGroup: "us-biotech" },
  GILD: { sector: "Healthcare", industry: "Biotech", country: "US", correlationGroup: "us-biotech" },
  ISRG: { sector: "Healthcare", industry: "MedDev/Robotics", country: "US", correlationGroup: "us-healthcare" },
  MRNA: { sector: "Healthcare", industry: "Biotech/mRNA", country: "US", correlationGroup: "us-biotech" },
  BIIB: { sector: "Healthcare", industry: "Biotech", country: "US", correlationGroup: "us-biotech" },

  // ── Consumer ──
  WMT: { sector: "Consumer Staples", industry: "Retail", country: "US", correlationGroup: "us-consumer-staples" },
  COST: { sector: "Consumer Staples", industry: "Retail", country: "US", correlationGroup: "us-consumer-staples" },
  HD: { sector: "Consumer Discretionary", industry: "Home Improvement", country: "US", correlationGroup: "us-consumer-disc" },
  LOW: { sector: "Consumer Discretionary", industry: "Home Improvement", country: "US", correlationGroup: "us-consumer-disc" },
  KO: { sector: "Consumer Staples", industry: "Beverages", country: "US", correlationGroup: "us-consumer-staples" },
  PEP: { sector: "Consumer Staples", industry: "Beverages/Snacks", country: "US", correlationGroup: "us-consumer-staples" },
  MCD: { sector: "Consumer Discretionary", industry: "Restaurants", country: "US", correlationGroup: "us-consumer-disc" },
  SBUX: { sector: "Consumer Discretionary", industry: "Restaurants", country: "US", correlationGroup: "us-consumer-disc" },
  NKE: { sector: "Consumer Discretionary", industry: "Apparel", country: "US", correlationGroup: "us-consumer-disc" },
  DIS: { sector: "Communication Services", industry: "Entertainment", country: "US", correlationGroup: "us-digital-media" },
  PG: { sector: "Consumer Staples", industry: "Household Products", country: "US", correlationGroup: "us-consumer-staples" },
  CL: { sector: "Consumer Staples", industry: "Household Products", country: "US", correlationGroup: "us-consumer-staples" },
  EL: { sector: "Consumer Staples", industry: "Personal Care", country: "US", correlationGroup: "us-consumer-staples" },
  TGT: { sector: "Consumer Discretionary", industry: "Retail", country: "US", correlationGroup: "us-consumer-disc" },

  // ── Industrials & Defense ──
  BA: { sector: "Industrials", industry: "Aerospace", country: "US", correlationGroup: "us-defense-aero" },
  CAT: { sector: "Industrials", industry: "Machinery", country: "US", correlationGroup: "us-industrials" },
  DE: { sector: "Industrials", industry: "Machinery/Ag", country: "US", correlationGroup: "us-industrials" },
  HON: { sector: "Industrials", industry: "Conglomerate", country: "US", correlationGroup: "us-industrials" },
  GE: { sector: "Industrials", industry: "Aerospace", country: "US", correlationGroup: "us-defense-aero" },
  LMT: { sector: "Industrials", industry: "Defense", country: "US", correlationGroup: "us-defense-aero" },
  RTX: { sector: "Industrials", industry: "Defense", country: "US", correlationGroup: "us-defense-aero" },
  UPS: { sector: "Industrials", industry: "Logistics", country: "US", correlationGroup: "us-industrials" },
  MMM: { sector: "Industrials", industry: "Conglomerate", country: "US", correlationGroup: "us-industrials" },
  UNP: { sector: "Industrials", industry: "Railroads", country: "US", correlationGroup: "us-industrials" },

  // ── Energy ──
  XOM: { sector: "Energy", industry: "Oil & Gas", country: "US", correlationGroup: "us-oil-gas" },
  CVX: { sector: "Energy", industry: "Oil & Gas", country: "US", correlationGroup: "us-oil-gas" },
  COP: { sector: "Energy", industry: "Oil & Gas", country: "US", correlationGroup: "us-oil-gas" },
  SLB: { sector: "Energy", industry: "Oil Services", country: "US", correlationGroup: "us-oil-gas" },
  EOG: { sector: "Energy", industry: "Oil & Gas", country: "US", correlationGroup: "us-oil-gas" },
  OXY: { sector: "Energy", industry: "Oil & Gas", country: "US", correlationGroup: "us-oil-gas" },

  // ── Telecom ──
  T: { sector: "Communication Services", industry: "Telecom", country: "US", correlationGroup: "us-telecom" },
  VZ: { sector: "Communication Services", industry: "Telecom", country: "US", correlationGroup: "us-telecom" },
  TMUS: { sector: "Communication Services", industry: "Telecom", country: "US", correlationGroup: "us-telecom" },
  CMCSA: { sector: "Communication Services", industry: "Cable/Telecom", country: "US", correlationGroup: "us-telecom" },

  // ── Materials & Mining ──
  GOLD: { sector: "Materials", industry: "Gold Mining", country: "Canada", correlationGroup: "gold-miners" },
  NEM: { sector: "Materials", industry: "Gold Mining", country: "US", correlationGroup: "gold-miners" },
  FCX: { sector: "Materials", industry: "Copper Mining", country: "US", correlationGroup: "base-metals" },
  X: { sector: "Materials", industry: "Steel", country: "US", correlationGroup: "base-metals" },
  AA: { sector: "Materials", industry: "Aluminum", country: "US", correlationGroup: "base-metals" },
  CLF: { sector: "Materials", industry: "Steel/Iron Ore", country: "US", correlationGroup: "base-metals" },

  // ── Autos & EV ──
  F: { sector: "Consumer Discretionary", industry: "Auto", country: "US", correlationGroup: "us-auto" },
  GM: { sector: "Consumer Discretionary", industry: "Auto", country: "US", correlationGroup: "us-auto" },
  RIVN: { sector: "Consumer Discretionary", industry: "Electric Vehicles", country: "US", correlationGroup: "us-ev" },
  LCID: { sector: "Consumer Discretionary", industry: "Electric Vehicles", country: "US", correlationGroup: "us-ev" },

  // ── ETFs ──
  SPY: { sector: "ETF", industry: "Broad Market", country: "US", correlationGroup: "us-broad-market" },
  QQQ: { sector: "ETF", industry: "Tech/Nasdaq", country: "US", correlationGroup: "us-megacap-tech" },
  IWM: { sector: "ETF", industry: "Small Cap", country: "US", correlationGroup: "us-broad-market" },
  EEM: { sector: "ETF", industry: "Emerging Markets", country: "Global", correlationGroup: "emerging-markets" },
  XLF: { sector: "ETF", industry: "Financials Sector", country: "US", correlationGroup: "us-banks" },
  XLE: { sector: "ETF", industry: "Energy Sector", country: "US", correlationGroup: "us-oil-gas" },
  XLK: { sector: "ETF", industry: "Tech Sector", country: "US", correlationGroup: "us-megacap-tech" },
  GLD: { sector: "ETF", industry: "Gold", country: "Global", correlationGroup: "gold-miners" },
  SLV: { sector: "ETF", industry: "Silver", country: "Global", correlationGroup: "base-metals" },
  EWZ: { sector: "ETF", industry: "Brazil", country: "Brazil", correlationGroup: "latam-broad" },
  DIA: { sector: "ETF", industry: "Broad Market", country: "US", correlationGroup: "us-broad-market" },
  ARKK: { sector: "ETF", industry: "Innovation/Growth", country: "US", correlationGroup: "us-growth-spec" },

  // ── Argentine Stocks ──
  GGAL: { sector: "Financials", industry: "Banking", country: "Argentina", correlationGroup: "ar-banks" },
  YPF: { sector: "Energy", industry: "Oil & Gas", country: "Argentina", correlationGroup: "ar-energy" },
  PAMP: { sector: "Energy", industry: "Utilities/Energy", country: "Argentina", correlationGroup: "ar-energy" },
  BBAR: { sector: "Financials", industry: "Banking", country: "Argentina", correlationGroup: "ar-banks" },
  BMA: { sector: "Financials", industry: "Banking", country: "Argentina", correlationGroup: "ar-banks" },
  SUPV: { sector: "Financials", industry: "Banking", country: "Argentina", correlationGroup: "ar-banks" },
  TECO2: { sector: "Communication Services", industry: "Telecom", country: "Argentina", correlationGroup: "ar-utilities" },
  TXAR: { sector: "Materials", industry: "Steel", country: "Argentina", correlationGroup: "ar-materials" },
  ALUA: { sector: "Materials", industry: "Aluminum", country: "Argentina", correlationGroup: "ar-materials" },
  CRES: { sector: "Real Estate", industry: "Agriculture/Real Estate", country: "Argentina", correlationGroup: "ar-agro" },
  MIRG: { sector: "Consumer Discretionary", industry: "Electronics/Auto", country: "Argentina", correlationGroup: "ar-industrial" },
  LOMA: { sector: "Materials", industry: "Cement", country: "Argentina", correlationGroup: "ar-materials" },
  CEPU: { sector: "Utilities", industry: "Power Generation", country: "Argentina", correlationGroup: "ar-utilities" },
  EDN: { sector: "Utilities", industry: "Power Distribution", country: "Argentina", correlationGroup: "ar-utilities" },
  TGSU2: { sector: "Utilities", industry: "Gas Transport", country: "Argentina", correlationGroup: "ar-utilities" },
  TGNO4: { sector: "Utilities", industry: "Gas Transport", country: "Argentina", correlationGroup: "ar-utilities" },
  VALO: { sector: "Financials", industry: "Brokerage", country: "Argentina", correlationGroup: "ar-banks" },
  COME: { sector: "Financials", industry: "Holding/Diversified", country: "Argentina", correlationGroup: "ar-diversified" },
  BYMA: { sector: "Financials", industry: "Exchange", country: "Argentina", correlationGroup: "ar-banks" },
  HARG: { sector: "Materials", industry: "Cement", country: "Argentina", correlationGroup: "ar-materials" },
  AGRO: { sector: "Industrials", industry: "Farm Equipment", country: "Argentina", correlationGroup: "ar-agro" },
  IRSA: { sector: "Real Estate", industry: "Real Estate", country: "Argentina", correlationGroup: "ar-real-estate" },
  TRAN: { sector: "Utilities", industry: "Power Transmission", country: "Argentina", correlationGroup: "ar-utilities" },
  BHIP: { sector: "Financials", industry: "Banking", country: "Argentina", correlationGroup: "ar-banks" },
  CVH: { sector: "Communication Services", industry: "Cable/Media", country: "Argentina", correlationGroup: "ar-utilities" },
  RICH: { sector: "Healthcare", industry: "Pharma", country: "Argentina", correlationGroup: "ar-healthcare" },
  MOLA: { sector: "Consumer Staples", industry: "Food/Agro", country: "Argentina", correlationGroup: "ar-agro" },
  MOLI: { sector: "Consumer Staples", industry: "Food", country: "Argentina", correlationGroup: "ar-consumer" },
  LEDE: { sector: "Consumer Staples", industry: "Sugar/Agro", country: "Argentina", correlationGroup: "ar-agro" },
  GCLA: { sector: "Communication Services", industry: "Media", country: "Argentina", correlationGroup: "ar-diversified" },
};

/**
 * Get metadata for a ticker. Returns a default "Unknown" entry if not found.
 */
export function getTickerMeta(ticker: string): TickerMeta {
  return META[ticker.toUpperCase()] ?? {
    sector: "Other",
    industry: "Unknown",
    country: "Unknown",
    correlationGroup: "ungrouped",
  };
}

/**
 * Get metadata map for an array of tickers.
 */
export function getTickerMetaMap(tickers: string[]): Record<string, TickerMeta> {
  const map: Record<string, TickerMeta> = {};
  for (const t of tickers) {
    map[t.toUpperCase()] = getTickerMeta(t);
  }
  return map;
}
