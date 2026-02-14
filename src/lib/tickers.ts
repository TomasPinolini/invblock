/**
 * Centralized ticker registry — the single source of truth for all instruments.
 *
 * Used by:
 *   - Explore page fallback (when IOL market is closed)
 *   - Watchlist search / suggestions
 *   - Dashboard group prices
 *   - Any future search or autocomplete
 *
 * During market hours the IOL API provides live data.
 * This list ensures the app is fully browsable 24/7.
 */

import type { IOLInstrumentType } from "@/services/iol";

export interface TickerEntry {
  simbolo: string;
  descripcion: string;
  type: IOLInstrumentType;
}

// ── CEDEARs (US & International stocks traded on BCBA) ──────────────────────

const CEDEARS: TickerEntry[] = [
  // ── Mega-cap Tech ──
  { simbolo: "AAPL", descripcion: "Apple Inc.", type: "cedears" },
  { simbolo: "MSFT", descripcion: "Microsoft Corp.", type: "cedears" },
  { simbolo: "GOOGL", descripcion: "Alphabet Inc. (Class A)", type: "cedears" },
  { simbolo: "GOOG", descripcion: "Alphabet Inc. (Class C)", type: "cedears" },
  { simbolo: "AMZN", descripcion: "Amazon.com Inc.", type: "cedears" },
  { simbolo: "META", descripcion: "Meta Platforms Inc.", type: "cedears" },
  { simbolo: "NVDA", descripcion: "NVIDIA Corp.", type: "cedears" },
  { simbolo: "TSLA", descripcion: "Tesla Inc.", type: "cedears" },

  // ── Semiconductors ──
  { simbolo: "AVGO", descripcion: "Broadcom Inc.", type: "cedears" },
  { simbolo: "TSM", descripcion: "Taiwan Semiconductor (ADR)", type: "cedears" },
  { simbolo: "ASML", descripcion: "ASML Holding N.V.", type: "cedears" },
  { simbolo: "AMD", descripcion: "Advanced Micro Devices", type: "cedears" },
  { simbolo: "INTC", descripcion: "Intel Corp.", type: "cedears" },
  { simbolo: "QCOM", descripcion: "Qualcomm Inc.", type: "cedears" },
  { simbolo: "TXN", descripcion: "Texas Instruments Inc.", type: "cedears" },
  { simbolo: "MU", descripcion: "Micron Technology Inc.", type: "cedears" },
  { simbolo: "AMAT", descripcion: "Applied Materials Inc.", type: "cedears" },
  { simbolo: "LRCX", descripcion: "Lam Research Corp.", type: "cedears" },
  { simbolo: "KLAC", descripcion: "KLA Corp.", type: "cedears" },
  { simbolo: "ENTG", descripcion: "Entegris Inc.", type: "cedears" },
  { simbolo: "MRVL", descripcion: "Marvell Technology Inc.", type: "cedears" },
  { simbolo: "ON", descripcion: "ON Semiconductor Corp.", type: "cedears" },
  { simbolo: "ADI", descripcion: "Analog Devices Inc.", type: "cedears" },
  { simbolo: "NXPI", descripcion: "NXP Semiconductors N.V.", type: "cedears" },
  { simbolo: "ARM", descripcion: "Arm Holdings plc (ADR)", type: "cedears" },

  // ── Software & Cloud ──
  { simbolo: "CRM", descripcion: "Salesforce Inc.", type: "cedears" },
  { simbolo: "ORCL", descripcion: "Oracle Corp.", type: "cedears" },
  { simbolo: "NOW", descripcion: "ServiceNow Inc.", type: "cedears" },
  { simbolo: "ADBE", descripcion: "Adobe Inc.", type: "cedears" },
  { simbolo: "INTU", descripcion: "Intuit Inc.", type: "cedears" },
  { simbolo: "SNOW", descripcion: "Snowflake Inc.", type: "cedears" },
  { simbolo: "PLTR", descripcion: "Palantir Technologies Inc.", type: "cedears" },
  { simbolo: "SHOP", descripcion: "Shopify Inc.", type: "cedears" },
  { simbolo: "NET", descripcion: "Cloudflare Inc.", type: "cedears" },
  { simbolo: "PANW", descripcion: "Palo Alto Networks Inc.", type: "cedears" },
  { simbolo: "CRWD", descripcion: "CrowdStrike Holdings Inc.", type: "cedears" },
  { simbolo: "ZS", descripcion: "Zscaler Inc.", type: "cedears" },
  { simbolo: "DDOG", descripcion: "Datadog Inc.", type: "cedears" },
  { simbolo: "MDB", descripcion: "MongoDB Inc.", type: "cedears" },
  { simbolo: "TEAM", descripcion: "Atlassian Corp.", type: "cedears" },
  { simbolo: "HUBS", descripcion: "HubSpot Inc.", type: "cedears" },
  { simbolo: "WDAY", descripcion: "Workday Inc.", type: "cedears" },
  { simbolo: "VEEV", descripcion: "Veeva Systems Inc.", type: "cedears" },
  { simbolo: "TTD", descripcion: "The Trade Desk Inc.", type: "cedears" },
  { simbolo: "U", descripcion: "Unity Software Inc.", type: "cedears" },
  { simbolo: "TWLO", descripcion: "Twilio Inc.", type: "cedears" },
  { simbolo: "OKTA", descripcion: "Okta Inc.", type: "cedears" },

  // ── Internet & Digital ──
  { simbolo: "NFLX", descripcion: "Netflix Inc.", type: "cedears" },
  { simbolo: "SPOT", descripcion: "Spotify Technology S.A.", type: "cedears" },
  { simbolo: "UBER", descripcion: "Uber Technologies Inc.", type: "cedears" },
  { simbolo: "ABNB", descripcion: "Airbnb Inc.", type: "cedears" },
  { simbolo: "SNAP", descripcion: "Snap Inc.", type: "cedears" },
  { simbolo: "PINS", descripcion: "Pinterest Inc.", type: "cedears" },
  { simbolo: "SQ", descripcion: "Block Inc. (Square)", type: "cedears" },
  { simbolo: "PYPL", descripcion: "PayPal Holdings Inc.", type: "cedears" },
  { simbolo: "COIN", descripcion: "Coinbase Global Inc.", type: "cedears" },
  { simbolo: "RBLX", descripcion: "Roblox Corp.", type: "cedears" },
  { simbolo: "DASH", descripcion: "DoorDash Inc.", type: "cedears" },

  // ── LatAm ──
  { simbolo: "MELI", descripcion: "MercadoLibre Inc.", type: "cedears" },
  { simbolo: "GLOB", descripcion: "Globant S.A.", type: "cedears" },
  { simbolo: "DESP", descripcion: "Despegar.com Corp.", type: "cedears" },
  { simbolo: "NU", descripcion: "Nu Holdings Ltd.", type: "cedears" },
  { simbolo: "STNE", descripcion: "StoneCo Ltd.", type: "cedears" },
  { simbolo: "PBR", descripcion: "Petrobras S.A. (ADR)", type: "cedears" },
  { simbolo: "VALE", descripcion: "Vale S.A. (ADR)", type: "cedears" },
  { simbolo: "BBD", descripcion: "Banco Bradesco S.A. (ADR)", type: "cedears" },
  { simbolo: "ITUB", descripcion: "Itaú Unibanco (ADR)", type: "cedears" },

  // ── China / Asia ──
  { simbolo: "BABA", descripcion: "Alibaba Group (ADR)", type: "cedears" },
  { simbolo: "JD", descripcion: "JD.com Inc. (ADR)", type: "cedears" },
  { simbolo: "PDD", descripcion: "PDD Holdings Inc. (ADR)", type: "cedears" },
  { simbolo: "BIDU", descripcion: "Baidu Inc. (ADR)", type: "cedears" },
  { simbolo: "NIO", descripcion: "NIO Inc. (ADR)", type: "cedears" },
  { simbolo: "LI", descripcion: "Li Auto Inc. (ADR)", type: "cedears" },
  { simbolo: "XPEV", descripcion: "XPeng Inc. (ADR)", type: "cedears" },

  // ── Financials ──
  { simbolo: "JPM", descripcion: "JPMorgan Chase & Co.", type: "cedears" },
  { simbolo: "V", descripcion: "Visa Inc.", type: "cedears" },
  { simbolo: "MA", descripcion: "Mastercard Inc.", type: "cedears" },
  { simbolo: "GS", descripcion: "Goldman Sachs Group", type: "cedears" },
  { simbolo: "MS", descripcion: "Morgan Stanley", type: "cedears" },
  { simbolo: "BAC", descripcion: "Bank of America Corp.", type: "cedears" },
  { simbolo: "C", descripcion: "Citigroup Inc.", type: "cedears" },
  { simbolo: "WFC", descripcion: "Wells Fargo & Co.", type: "cedears" },
  { simbolo: "SCHW", descripcion: "Charles Schwab Corp.", type: "cedears" },
  { simbolo: "BLK", descripcion: "BlackRock Inc.", type: "cedears" },
  { simbolo: "AXP", descripcion: "American Express Co.", type: "cedears" },
  { simbolo: "BRK.B", descripcion: "Berkshire Hathaway (B)", type: "cedears" },

  // ── Healthcare & Pharma ──
  { simbolo: "UNH", descripcion: "UnitedHealth Group Inc.", type: "cedears" },
  { simbolo: "JNJ", descripcion: "Johnson & Johnson", type: "cedears" },
  { simbolo: "PFE", descripcion: "Pfizer Inc.", type: "cedears" },
  { simbolo: "ABBV", descripcion: "AbbVie Inc.", type: "cedears" },
  { simbolo: "LLY", descripcion: "Eli Lilly & Co.", type: "cedears" },
  { simbolo: "MRK", descripcion: "Merck & Co. Inc.", type: "cedears" },
  { simbolo: "TMO", descripcion: "Thermo Fisher Scientific", type: "cedears" },
  { simbolo: "ABT", descripcion: "Abbott Laboratories", type: "cedears" },
  { simbolo: "BMY", descripcion: "Bristol-Myers Squibb", type: "cedears" },
  { simbolo: "AMGN", descripcion: "Amgen Inc.", type: "cedears" },
  { simbolo: "GILD", descripcion: "Gilead Sciences Inc.", type: "cedears" },
  { simbolo: "ISRG", descripcion: "Intuitive Surgical Inc.", type: "cedears" },
  { simbolo: "MRNA", descripcion: "Moderna Inc.", type: "cedears" },
  { simbolo: "BIIB", descripcion: "Biogen Inc.", type: "cedears" },

  // ── Consumer ──
  { simbolo: "WMT", descripcion: "Walmart Inc.", type: "cedears" },
  { simbolo: "COST", descripcion: "Costco Wholesale Corp.", type: "cedears" },
  { simbolo: "HD", descripcion: "Home Depot Inc.", type: "cedears" },
  { simbolo: "LOW", descripcion: "Lowe's Companies Inc.", type: "cedears" },
  { simbolo: "KO", descripcion: "Coca-Cola Co.", type: "cedears" },
  { simbolo: "PEP", descripcion: "PepsiCo Inc.", type: "cedears" },
  { simbolo: "MCD", descripcion: "McDonald's Corp.", type: "cedears" },
  { simbolo: "SBUX", descripcion: "Starbucks Corp.", type: "cedears" },
  { simbolo: "NKE", descripcion: "Nike Inc.", type: "cedears" },
  { simbolo: "DIS", descripcion: "Walt Disney Co.", type: "cedears" },
  { simbolo: "PG", descripcion: "Procter & Gamble Co.", type: "cedears" },
  { simbolo: "CL", descripcion: "Colgate-Palmolive Co.", type: "cedears" },
  { simbolo: "EL", descripcion: "Estée Lauder Companies", type: "cedears" },
  { simbolo: "TGT", descripcion: "Target Corp.", type: "cedears" },

  // ── Industrials & Defense ──
  { simbolo: "BA", descripcion: "Boeing Co.", type: "cedears" },
  { simbolo: "CAT", descripcion: "Caterpillar Inc.", type: "cedears" },
  { simbolo: "DE", descripcion: "Deere & Company", type: "cedears" },
  { simbolo: "HON", descripcion: "Honeywell International", type: "cedears" },
  { simbolo: "GE", descripcion: "GE Aerospace", type: "cedears" },
  { simbolo: "LMT", descripcion: "Lockheed Martin Corp.", type: "cedears" },
  { simbolo: "RTX", descripcion: "RTX Corp. (Raytheon)", type: "cedears" },
  { simbolo: "UPS", descripcion: "United Parcel Service", type: "cedears" },
  { simbolo: "MMM", descripcion: "3M Company", type: "cedears" },
  { simbolo: "UNP", descripcion: "Union Pacific Corp.", type: "cedears" },

  // ── Energy ──
  { simbolo: "XOM", descripcion: "Exxon Mobil Corp.", type: "cedears" },
  { simbolo: "CVX", descripcion: "Chevron Corp.", type: "cedears" },
  { simbolo: "COP", descripcion: "ConocoPhillips", type: "cedears" },
  { simbolo: "SLB", descripcion: "Schlumberger Ltd.", type: "cedears" },
  { simbolo: "EOG", descripcion: "EOG Resources Inc.", type: "cedears" },
  { simbolo: "OXY", descripcion: "Occidental Petroleum", type: "cedears" },

  // ── Telecom & Media ──
  { simbolo: "T", descripcion: "AT&T Inc.", type: "cedears" },
  { simbolo: "VZ", descripcion: "Verizon Communications", type: "cedears" },
  { simbolo: "TMUS", descripcion: "T-Mobile US Inc.", type: "cedears" },
  { simbolo: "CMCSA", descripcion: "Comcast Corp.", type: "cedears" },

  // ── Materials & Mining ──
  { simbolo: "GOLD", descripcion: "Barrick Gold Corp.", type: "cedears" },
  { simbolo: "NEM", descripcion: "Newmont Corp.", type: "cedears" },
  { simbolo: "FCX", descripcion: "Freeport-McMoRan Inc.", type: "cedears" },
  { simbolo: "X", descripcion: "United States Steel Corp.", type: "cedears" },
  { simbolo: "AA", descripcion: "Alcoa Corp.", type: "cedears" },
  { simbolo: "CLF", descripcion: "Cleveland-Cliffs Inc.", type: "cedears" },

  // ── Autos & EV ──
  { simbolo: "F", descripcion: "Ford Motor Co.", type: "cedears" },
  { simbolo: "GM", descripcion: "General Motors Co.", type: "cedears" },
  { simbolo: "RIVN", descripcion: "Rivian Automotive Inc.", type: "cedears" },
  { simbolo: "LCID", descripcion: "Lucid Group Inc.", type: "cedears" },

  // ── ETFs (traded as CEDEARs on BCBA) ──
  { simbolo: "SPY", descripcion: "SPDR S&P 500 ETF Trust", type: "cedears" },
  { simbolo: "QQQ", descripcion: "Invesco QQQ Trust (Nasdaq-100)", type: "cedears" },
  { simbolo: "IWM", descripcion: "iShares Russell 2000 ETF", type: "cedears" },
  { simbolo: "EEM", descripcion: "iShares MSCI Emerging Markets ETF", type: "cedears" },
  { simbolo: "XLF", descripcion: "Financial Select Sector SPDR", type: "cedears" },
  { simbolo: "XLE", descripcion: "Energy Select Sector SPDR", type: "cedears" },
  { simbolo: "XLK", descripcion: "Technology Select Sector SPDR", type: "cedears" },
  { simbolo: "GLD", descripcion: "SPDR Gold Shares ETF", type: "cedears" },
  { simbolo: "SLV", descripcion: "iShares Silver Trust ETF", type: "cedears" },
  { simbolo: "EWZ", descripcion: "iShares MSCI Brazil ETF", type: "cedears" },
  { simbolo: "DIA", descripcion: "SPDR Dow Jones Industrial ETF", type: "cedears" },
  { simbolo: "ARKK", descripcion: "ARK Innovation ETF", type: "cedears" },
];

// ── Argentine Stocks (Acciones) ─────────────────────────────────────────────

const ACCIONES: TickerEntry[] = [
  // Panel Líder
  { simbolo: "GGAL", descripcion: "Grupo Financiero Galicia", type: "acciones" },
  { simbolo: "YPF", descripcion: "YPF S.A.", type: "acciones" },
  { simbolo: "PAMP", descripcion: "Pampa Energía S.A.", type: "acciones" },
  { simbolo: "BBAR", descripcion: "Banco BBVA Argentina", type: "acciones" },
  { simbolo: "BMA", descripcion: "Banco Macro S.A.", type: "acciones" },
  { simbolo: "SUPV", descripcion: "Grupo Supervielle S.A.", type: "acciones" },
  { simbolo: "TECO2", descripcion: "Telecom Argentina S.A.", type: "acciones" },
  { simbolo: "TXAR", descripcion: "Ternium Argentina S.A.", type: "acciones" },
  { simbolo: "ALUA", descripcion: "Aluar Aluminio Argentino", type: "acciones" },
  { simbolo: "CRES", descripcion: "Cresud S.A.", type: "acciones" },
  { simbolo: "MIRG", descripcion: "Mirgor S.A.", type: "acciones" },
  { simbolo: "LOMA", descripcion: "Loma Negra C.I.A.S.A.", type: "acciones" },
  { simbolo: "CEPU", descripcion: "Central Puerto S.A.", type: "acciones" },
  { simbolo: "EDN", descripcion: "Edenor S.A.", type: "acciones" },
  { simbolo: "TGSU2", descripcion: "Transportadora de Gas del Sur", type: "acciones" },
  { simbolo: "TGNO4", descripcion: "Transportadora de Gas del Norte", type: "acciones" },
  { simbolo: "VALO", descripcion: "Grupo Valores S.A.", type: "acciones" },
  { simbolo: "COME", descripcion: "Sociedad Comercial del Plata", type: "acciones" },
  // Panel General
  { simbolo: "BYMA", descripcion: "Bolsas y Mercados Argentinos", type: "acciones" },
  { simbolo: "HARG", descripcion: "Holcim Argentina S.A.", type: "acciones" },
  { simbolo: "AGRO", descripcion: "Agrometal S.A.I.C.", type: "acciones" },
  { simbolo: "AUSO", descripcion: "Autopistas del Sol S.A.", type: "acciones" },
  { simbolo: "BHIP", descripcion: "Banco Hipotecario S.A.", type: "acciones" },
  { simbolo: "BOLT", descripcion: "Boldt S.A.", type: "acciones" },
  { simbolo: "CARC", descripcion: "Carboclor S.A.", type: "acciones" },
  { simbolo: "CGPA2", descripcion: "Camuzzi Gas Pampeana", type: "acciones" },
  { simbolo: "CELU", descripcion: "Celulosa Argentina S.A.", type: "acciones" },
  { simbolo: "CVH", descripcion: "Cablevision Holding S.A.", type: "acciones" },
  { simbolo: "DGCU2", descripcion: "Distribuidora de Gas Cuyana", type: "acciones" },
  { simbolo: "DOME", descripcion: "Domec S.A.", type: "acciones" },
  { simbolo: "DYCA", descripcion: "Dycasa S.A.", type: "acciones" },
  { simbolo: "FERR", descripcion: "Ferrum S.A.", type: "acciones" },
  { simbolo: "FIPL", descripcion: "Fiplasto S.A.", type: "acciones" },
  { simbolo: "GAMI", descripcion: "Gamatec S.A.", type: "acciones" },
  { simbolo: "GARO", descripcion: "Garovaglio y Zorraquín S.A.", type: "acciones" },
  { simbolo: "GCLA", descripcion: "Grupo Clarín S.A.", type: "acciones" },
  { simbolo: "GRIM", descripcion: "Grimoldi S.A.", type: "acciones" },
  { simbolo: "INVJ", descripcion: "Inversora Juramento S.A.", type: "acciones" },
  { simbolo: "IRSA", descripcion: "IRSA Inversiones S.A.", type: "acciones" },
  { simbolo: "LEDE", descripcion: "Ledesma S.A.", type: "acciones" },
  { simbolo: "LONG", descripcion: "Longvie S.A.", type: "acciones" },
  { simbolo: "METR", descripcion: "Metrogas S.A.", type: "acciones" },
  { simbolo: "MOLA", descripcion: "Molinos Agro S.A.", type: "acciones" },
  { simbolo: "MOLI", descripcion: "Molinos Río de la Plata", type: "acciones" },
  { simbolo: "MORI", descripcion: "Morixe Hnos. S.A.", type: "acciones" },
  { simbolo: "PATA", descripcion: "S.A. San Miguel", type: "acciones" },
  { simbolo: "RICH", descripcion: "Laboratorios Richmond", type: "acciones" },
  { simbolo: "RIGO", descripcion: "Rigolleau S.A.", type: "acciones" },
  { simbolo: "ROSE", descripcion: "Instituto Rosenbusch S.A.", type: "acciones" },
  { simbolo: "SAMI", descripcion: "S.A. San Miguel", type: "acciones" },
  { simbolo: "SEMI", descripcion: "Molinos Juan Semino S.A.", type: "acciones" },
  { simbolo: "TRAN", descripcion: "Transener S.A.", type: "acciones" },
];

// ── Sovereign Bonds (Títulos Públicos) ──────────────────────────────────────

const BONOS: TickerEntry[] = [
  // USD Ley Argentina
  { simbolo: "AL29", descripcion: "Bono Argentina 2029 (Ley Arg.)", type: "titulosPublicos" },
  { simbolo: "AL30", descripcion: "Bono Argentina 2030 (Ley Arg.)", type: "titulosPublicos" },
  { simbolo: "AL35", descripcion: "Bono Argentina 2035 (Ley Arg.)", type: "titulosPublicos" },
  { simbolo: "AL41", descripcion: "Bono Argentina 2041 (Ley Arg.)", type: "titulosPublicos" },
  { simbolo: "AE38", descripcion: "Bono Argentina 2038", type: "titulosPublicos" },
  // USD Ley NY (Globales)
  { simbolo: "GD29", descripcion: "Global 2029 (Ley NY)", type: "titulosPublicos" },
  { simbolo: "GD30", descripcion: "Global 2030 (Ley NY)", type: "titulosPublicos" },
  { simbolo: "GD35", descripcion: "Global 2035 (Ley NY)", type: "titulosPublicos" },
  { simbolo: "GD38", descripcion: "Global 2038 (Ley NY)", type: "titulosPublicos" },
  { simbolo: "GD41", descripcion: "Global 2041 (Ley NY)", type: "titulosPublicos" },
  { simbolo: "GD46", descripcion: "Global 2046 (Ley NY)", type: "titulosPublicos" },
  // CER (inflation-adjusted)
  { simbolo: "TX26", descripcion: "Boncer 2026 (CER)", type: "titulosPublicos" },
  { simbolo: "TX28", descripcion: "Boncer 2028 (CER)", type: "titulosPublicos" },
  { simbolo: "T2X5", descripcion: "Boncer 2025 (CER)", type: "titulosPublicos" },
  { simbolo: "DICP", descripcion: "Discount ARS (CER)", type: "titulosPublicos" },
  { simbolo: "PARP", descripcion: "Par ARS (CER)", type: "titulosPublicos" },
  // Dual
  { simbolo: "TDJ25", descripcion: "Bono Dual Jun 2025", type: "titulosPublicos" },
  { simbolo: "TDE25", descripcion: "Bono Dual Ene 2025", type: "titulosPublicos" },
  // LECAPs / LEFIs
  { simbolo: "S31O5", descripcion: "LECAP Oct 2025", type: "titulosPublicos" },
  { simbolo: "S30J5", descripcion: "LECAP Jun 2025", type: "titulosPublicos" },
  { simbolo: "S31M5", descripcion: "LECAP Mar 2025", type: "titulosPublicos" },
  // Bopreal
  { simbolo: "BPY26", descripcion: "Bopreal Serie 1-A 2026", type: "titulosPublicos" },
  { simbolo: "BPJ25", descripcion: "Bopreal Serie 1-B 2025", type: "titulosPublicos" },
  { simbolo: "BPOA7", descripcion: "Bopreal Serie 2 2027", type: "titulosPublicos" },
  { simbolo: "BPOB7", descripcion: "Bopreal Serie 3 2027", type: "titulosPublicos" },
];

// ── Corporate Bonds (Obligaciones Negociables) ──────────────────────────────

const ONS: TickerEntry[] = [
  { simbolo: "YCA6O", descripcion: "ON YPF 2026 USD", type: "obligacionesNegociables" },
  { simbolo: "MRCAO", descripcion: "ON Mirgor 2026", type: "obligacionesNegociables" },
  { simbolo: "TLCHO", descripcion: "ON Telecom 2026", type: "obligacionesNegociables" },
  { simbolo: "PNDCO", descripcion: "ON Pampa Energía", type: "obligacionesNegociables" },
  { simbolo: "YMCHO", descripcion: "ON YPF 2026 clase XLVII", type: "obligacionesNegociables" },
  { simbolo: "CS38O", descripcion: "ON Cresud 2026", type: "obligacionesNegociables" },
  { simbolo: "IRCFO", descripcion: "ON IRSA 2028", type: "obligacionesNegociables" },
  { simbolo: "MTCGO", descripcion: "ON Mastellone 2026", type: "obligacionesNegociables" },
  { simbolo: "GNC9O", descripcion: "ON Genneia 2027", type: "obligacionesNegociables" },
  { simbolo: "RCCJO", descripcion: "ON Arcor 2027", type: "obligacionesNegociables" },
  { simbolo: "ALCAO", descripcion: "ON Aluar 2027", type: "obligacionesNegociables" },
  { simbolo: "LECAO", descripcion: "ON Ledesma 2027", type: "obligacionesNegociables" },
  { simbolo: "LOC3O", descripcion: "ON Loma Negra 2027", type: "obligacionesNegociables" },
  { simbolo: "CP17O", descripcion: "ON Central Puerto 2027", type: "obligacionesNegociables" },
  { simbolo: "ARC1O", descripcion: "ON Aeropuertos Argentina 2031", type: "obligacionesNegociables" },
];

// ── Merged & exported ───────────────────────────────────────────────────────

export const ALL_TICKERS: TickerEntry[] = [
  ...CEDEARS,
  ...ACCIONES,
  ...BONOS,
  ...ONS,
];

/** Filter by instrument type */
export function getTickersByType(type?: IOLInstrumentType): TickerEntry[] {
  if (!type) return ALL_TICKERS;
  return ALL_TICKERS.filter((t) => t.type === type);
}

/** Search tickers by symbol or description */
export function searchTickers(query: string, type?: IOLInstrumentType): TickerEntry[] {
  const q = query.toLowerCase();
  const base = type ? getTickersByType(type) : ALL_TICKERS;
  return base.filter(
    (t) =>
      t.simbolo.toLowerCase().includes(q) ||
      t.descripcion.toLowerCase().includes(q)
  );
}

/** Lookup a single ticker */
export function findTicker(simbolo: string): TickerEntry | undefined {
  return ALL_TICKERS.find((t) => t.simbolo === simbolo);
}
