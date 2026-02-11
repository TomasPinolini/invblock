// Static metadata and helpers for Argentine bonds and corporate ONs

export interface BondMetadata {
  ticker: string;
  maturityDate: string; // ISO date "YYYY-MM-DD"
  law: "argentina" | "new_york" | "n/a";
  currency: "USD" | "ARS" | "CER" | "USD-linked";
  couponRate: string; // Human-readable, e.g. "0.125% step-up", "Zero coupon"
  couponFrequency: "semestral" | "mensual" | "al_vencimiento" | "n/a";
  faceValue: number; // Typically 100 for USD bonds
  issuer?: string; // For ONs: "YPF", "Telecom", etc.
  sector?: string; // For ONs: "Energia", "Telecomunicaciones", etc.
  type: "soberano" | "corporate" | "lecap" | "boncer";
  pairTicker?: string; // For AL30 -> "GD30" and vice versa (Ley AR <-> Ley NY pair)
}

// ---------------------------------------------------------------------------
// Bond metadata registry
// ---------------------------------------------------------------------------

export const BOND_METADATA: Record<string, BondMetadata> = {
  // ---- Sovereign bonds (2020 restructured, step-up coupons, semi-annual Jan 9 / Jul 9) ----

  AL30: {
    ticker: "AL30",
    maturityDate: "2030-07-09",
    law: "argentina",
    currency: "USD",
    couponRate: "0.125% step-up",
    couponFrequency: "semestral",
    faceValue: 100,
    type: "soberano",
    pairTicker: "GD30",
  },
  GD30: {
    ticker: "GD30",
    maturityDate: "2030-07-09",
    law: "new_york",
    currency: "USD",
    couponRate: "0.125% step-up",
    couponFrequency: "semestral",
    faceValue: 100,
    type: "soberano",
    pairTicker: "AL30",
  },

  AL35: {
    ticker: "AL35",
    maturityDate: "2035-07-09",
    law: "argentina",
    currency: "USD",
    couponRate: "0.125% step-up",
    couponFrequency: "semestral",
    faceValue: 100,
    type: "soberano",
    pairTicker: "GD35",
  },
  GD35: {
    ticker: "GD35",
    maturityDate: "2035-07-09",
    law: "new_york",
    currency: "USD",
    couponRate: "0.125% step-up",
    couponFrequency: "semestral",
    faceValue: 100,
    type: "soberano",
    pairTicker: "AL35",
  },

  AL41: {
    ticker: "AL41",
    maturityDate: "2041-07-09",
    law: "argentina",
    currency: "USD",
    couponRate: "0.125% step-up",
    couponFrequency: "semestral",
    faceValue: 100,
    type: "soberano",
    pairTicker: "GD41",
  },
  GD41: {
    ticker: "GD41",
    maturityDate: "2041-07-09",
    law: "new_york",
    currency: "USD",
    couponRate: "0.125% step-up",
    couponFrequency: "semestral",
    faceValue: 100,
    type: "soberano",
    pairTicker: "AL41",
  },

  AE38: {
    ticker: "AE38",
    maturityDate: "2038-01-09",
    law: "argentina",
    currency: "USD",
    couponRate: "step-up",
    couponFrequency: "semestral",
    faceValue: 100,
    type: "soberano",
    pairTicker: "GD38",
  },
  GD38: {
    ticker: "GD38",
    maturityDate: "2038-01-09",
    law: "new_york",
    currency: "USD",
    couponRate: "step-up",
    couponFrequency: "semestral",
    faceValue: 100,
    type: "soberano",
    pairTicker: "AE38",
  },

  // ---- LECAP ----

  S31O5: {
    ticker: "S31O5",
    maturityDate: "2025-10-31",
    law: "argentina",
    currency: "ARS",
    couponRate: "Zero coupon (descuento)",
    couponFrequency: "al_vencimiento",
    faceValue: 1000,
    type: "lecap",
  },

  // ---- Boncer ----

  TX26: {
    ticker: "TX26",
    maturityDate: "2026-11-09",
    law: "argentina",
    currency: "CER",
    couponRate: "CER + 2%",
    couponFrequency: "semestral",
    faceValue: 1000,
    type: "boncer",
  },

  // ---- Corporate ONs ----

  YCA6O: {
    ticker: "YCA6O",
    maturityDate: "2026-07-07",
    law: "new_york",
    currency: "USD",
    couponRate: "8.5%",
    couponFrequency: "semestral",
    faceValue: 100,
    issuer: "YPF",
    sector: "Energia",
    type: "corporate",
  },
  MRCAO: {
    ticker: "MRCAO",
    maturityDate: "2026-04-15",
    law: "argentina",
    currency: "USD",
    couponRate: "7%",
    couponFrequency: "semestral",
    faceValue: 100,
    issuer: "Mirgor",
    sector: "Tecnologia",
    type: "corporate",
  },
  TLCHO: {
    ticker: "TLCHO",
    maturityDate: "2026-07-18",
    law: "argentina",
    currency: "USD",
    couponRate: "8%",
    couponFrequency: "semestral",
    faceValue: 100,
    issuer: "Telecom Argentina",
    sector: "Telecomunicaciones",
    type: "corporate",
  },
  PNDCO: {
    ticker: "PNDCO",
    maturityDate: "2027-09-01",
    law: "new_york",
    currency: "USD",
    couponRate: "7.5%",
    couponFrequency: "semestral",
    faceValue: 100,
    issuer: "Pampa Energia",
    sector: "Energia",
    type: "corporate",
  },
  YMCHO: {
    ticker: "YMCHO",
    maturityDate: "2026-12-15",
    law: "argentina",
    currency: "USD",
    couponRate: "9%",
    couponFrequency: "semestral",
    faceValue: 100,
    issuer: "YPF",
    sector: "Energia",
    type: "corporate",
  },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Get metadata for a ticker, or null if not a bond/ON */
export function getBondMeta(ticker: string): BondMetadata | null {
  return BOND_METADATA[ticker] ?? null;
}

/**
 * Get human-readable maturity info.
 * Returns { date: "09 Jul 2030", remaining: "4a 5m", isExpired: boolean }
 */
export function getMaturityInfo(
  ticker: string
): { date: string; remaining: string; isExpired: boolean } | null {
  const meta = getBondMeta(ticker);
  if (!meta) return null;

  const maturity = new Date(meta.maturityDate + "T00:00:00Z");
  const now = new Date();

  // Format date as "DD Mon YYYY"
  const day = String(maturity.getUTCDate()).padStart(2, "0");
  const monthNames = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const month = monthNames[maturity.getUTCMonth()];
  const year = maturity.getUTCFullYear();
  const date = `${day} ${month} ${year}`;

  // Calculate remaining time
  const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const matUTC = Date.UTC(
    maturity.getUTCFullYear(),
    maturity.getUTCMonth(),
    maturity.getUTCDate()
  );

  if (matUTC <= nowUTC) {
    return { date, remaining: "Vencido", isExpired: true };
  }

  // Diff in years and months
  let years = maturity.getUTCFullYear() - now.getUTCFullYear();
  let months = maturity.getUTCMonth() - now.getUTCMonth();

  // Adjust for day-of-month
  if (maturity.getUTCDate() < now.getUTCDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  let remaining: string;
  if (years > 0 && months > 0) {
    remaining = `${years}a ${months}m`;
  } else if (years > 0) {
    remaining = `${years}a`;
  } else {
    remaining = `${months}m`;
  }

  return { date, remaining, isExpired: false };
}

/**
 * Get parity as percentage of face value.
 * parity = (currentPrice / faceValue) * 100
 */
export function getParity(ticker: string, currentPrice: number): number | null {
  const meta = getBondMeta(ticker);
  if (!meta) return null;
  if (meta.faceValue === 0) return null;
  return (currentPrice / meta.faceValue) * 100;
}

/**
 * Get the spread between a Ley AR / Ley NY bond pair.
 * Returns the price difference or null if no pair exists.
 * The caller provides a price map.
 */
export function getBondPairSpread(
  ticker: string,
  prices: Map<string, number>
): { pairTicker: string; spread: number; spreadPct: number } | null {
  const meta = getBondMeta(ticker);
  if (!meta?.pairTicker) return null;

  const price = prices.get(ticker);
  const pairPrice = prices.get(meta.pairTicker);

  if (price == null || pairPrice == null) return null;
  if (pairPrice === 0) return null;

  const spread = price - pairPrice;
  const spreadPct = (spread / pairPrice) * 100;

  return {
    pairTicker: meta.pairTicker,
    spread,
    spreadPct,
  };
}
