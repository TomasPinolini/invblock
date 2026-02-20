import type { BrokerPortfolioAsset } from "@/types/portfolio";

/**
 * Shared mapping functions for normalizing broker data (IOL, PPI)
 * into our canonical portfolio types.
 */

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

/**
 * Map an IOL asset type + country to our canonical category.
 *
 * IOL provides `titulo.tipo` (e.g. "CEDEAR", "Acciones") and
 * `titulo.pais` (e.g. "estados_unidos", "argentina").
 */
export function mapIOLCategory(
  tipo: string,
  pais: string
): BrokerPortfolioAsset["category"] {
  const t = (tipo ?? "").toLowerCase();
  const p = (pais ?? "").toLowerCase();

  if (t.includes("cedear")) return "cedear";
  if (t.includes("crypto") || t.includes("cripto")) return "crypto";
  if (p === "estados_unidos") return "stock";
  return "stock";
}

/**
 * Map a PPI instrument type to our canonical category.
 *
 * PPI provides `InstrumentType` (e.g. "CEDEAR", "ACCION", "ETF", "BONO").
 */
export function mapPPICategory(
  instrumentType: string
): BrokerPortfolioAsset["category"] {
  const t = (instrumentType ?? "").toUpperCase();

  if (t.includes("CEDEAR")) return "cedear";
  if (t.includes("ACCION")) return "stock";
  if (t.includes("ETF")) return "stock";
  if (t.includes("BONO") || t.includes("LETRA") || t === "ON") return "stock";
  return "stock";
}

/**
 * Infer asset category from an IOL market string (used by transaction sync).
 *
 * IOL operations only expose `mercado` (e.g. "NYSE", "NASDAQ", "bCBA"),
 * so we infer from exchange names.
 */
export function inferCategoryFromMarket(
  mercado: string
): BrokerPortfolioAsset["category"] {
  const m = (mercado ?? "").toLowerCase();

  if (m.includes("nyse") || m.includes("nasdaq") || m.includes("amex")) {
    return "stock";
  }
  return "cedear";
}

// ---------------------------------------------------------------------------
// Currency mapping
// ---------------------------------------------------------------------------

/**
 * Map an IOL currency/moneda string to USD | ARS.
 *
 * IOL uses values like "peso_Argentino", "dolar_Estadounidense".
 */
export function mapIOLCurrency(moneda: string): "USD" | "ARS" {
  const m = (moneda ?? "").toLowerCase();
  if (m.includes("dolar") || m.includes("dollar")) return "USD";
  return "ARS";
}

/**
 * Map a PPI currency string to USD | ARS.
 *
 * PPI uses values like "USD", "ARS", "Dolares".
 */
export function mapPPICurrency(currency: string): "USD" | "ARS" {
  const c = (currency ?? "").toUpperCase();
  if (c.includes("USD") || c.includes("DOLAR") || c.includes("DOLLAR"))
    return "USD";
  return "ARS";
}

/**
 * Infer currency from an IOL market string (used by transaction sync).
 *
 * US exchanges imply USD, everything else defaults to ARS.
 */
export function inferCurrencyFromMarket(mercado: string): "USD" | "ARS" {
  const m = (mercado ?? "").toLowerCase();
  if (m.includes("nyse") || m.includes("nasdaq") || m.includes("estados")) {
    return "USD";
  }
  return "ARS";
}

// ---------------------------------------------------------------------------
// Operation type mapping (IOL transactions)
// ---------------------------------------------------------------------------

/**
 * Map an IOL operation type string to our buy/sell enum.
 *
 * IOL uses strings like "Compra" / "Venta".
 * Returns null for types we don't map (e.g. dividends, coupons).
 */
export function mapOperationType(tipo: string): "buy" | "sell" | null {
  const t = (tipo ?? "").toLowerCase();
  if (t.includes("compra")) return "buy";
  if (t.includes("venta")) return "sell";
  return null;
}
