// IOL API Types

export interface IOLToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  issued_at?: number; // Unix timestamp when token was issued
}

export interface IOLTitulo {
  simbolo: string; // Ticker symbol
  descripcion: string; // Asset name
  pais: string; // Country (argentina, estados_unidos)
  mercado: string; // Market (bcba, nyse, etc.)
  tipo: string; // Type: "CEDEARS", "ACCIONES", etc.
  plazo: string; // Settlement period (t0, t1, t2)
  moneda: string; // Currency (peso_Argentino, dolar_Estadounidense)
}

export interface IOLPortfolioItem {
  cantidad: number; // Quantity held
  comprometido: number; // Committed shares
  puntosVariacion: number;
  variacionDiaria: number;
  ultimoPrecio: number; // Last price
  ppc: number; // Average purchase price (Precio Promedio de Compra)
  gananciaPorcentaje: number; // P&L percentage
  gananciaDinero: number; // P&L in money
  valorizado: number; // Current value
  titulo: IOLTitulo; // Nested security info
  parking?: number | null; // Shares in parking (T+2 settlement)
}

export interface IOLPortfolio {
  pais: string;
  activos: IOLPortfolioItem[];
  totalEnPesos?: number;
  totalEnDolares?: number;
}

export interface IOLSaldo {
  liquidacion: string; // inmediato, hrs24, hrs48, hrs72, masHrs72
  saldo: number;
  comprometido: number;
  disponible: number;
  disponibleOperar: number; // What you can actually trade with
}

export interface IOLCuenta {
  numero: string;
  tipo: string; // inversion_Argentina_Pesos, inversion_Argentina_Dolares, inversion_Estados_Unidos_Dolares
  moneda: string; // peso_Argentino, dolar_Estadounidense
  disponible: number; // Available cash (immediate)
  comprometido: number; // Committed in open orders
  saldo: number; // Current balance
  titulosValorizados?: number; // Securities value
  total?: number; // Total account value
  margenDescubierto?: number; // Margin
  saldos?: IOLSaldo[]; // Settlement period breakdown
  estado?: string; // operable, etc.
}

export interface IOLAccountState {
  cuentas: IOLCuenta[];
  estadisticas?: unknown[];
  totalEnPesos?: number;
}

export interface IOLOperation {
  numero: number;
  fechaOrden: string;
  fechaOperada?: string; // When it was executed
  tipo: string; // "Compra" | "Venta" etc.
  estado: string; // "iniciada" | "pendiente" | "terminada" | "cancelada"
  mercado: string;
  simbolo: string;
  cantidad: number; // Ordered quantity
  cantidadOperada?: number; // Executed quantity
  precio: number; // Ordered price
  precioOperado?: number; // Executed price
  montoTotal: number; // Order total
  montoOperado?: number; // Executed total
  validez?: string; // Order validity
  plazo?: string; // Settlement period (T+0, T+1, etc.)
}

export interface IOLNotification {
  titulo: string;
  mensaje: string;
  link?: string;
}

// Quote/Cotización model from IOL API
export interface IOLPunta {
  precioCompra: number;
  precioVenta: number;
  cantidadCompra?: number;
  cantidadVenta?: number;
}

export interface IOLQuote {
  ultimoPrecio: number; // Last traded price
  variacion: number; // Daily change % (e.g., -2.81 means -2.81%)
  apertura: number; // Open
  maximo: number; // High
  minimo: number; // Low
  cierreAnterior: number; // Previous close
  volumenNominal?: number; // Volume in shares
  montoOperado?: number; // Volume in money
  tendencia?: "sube" | "baja" | "mantiene"; // Trend direction
  puntas?: IOLPunta[]; // Bid/ask spread
  fechaHora?: string; // Quote timestamp
  cantidadOperaciones?: number; // Number of trades
  moneda?: string; // Currency (e.g., "peso_Argentino")
  descripcionTitulo?: string; // Security description
  plazo?: string; // Settlement period (e.g., "T1")
}

// Order types for trading
export type IOLOrderType = "precioLimite" | "precioMercado";
export type IOLSettlement = "t0" | "t1" | "t2"; // T+0, T+1, T+2

export interface IOLOrderRequest {
  mercado: string; // bCBA, nYSE, nASDAQ, etc.
  simbolo: string; // Ticker
  cantidad: number; // Quantity
  precio: number; // Price (ignored for market orders)
  plazo: IOLSettlement; // Settlement period
  validez: string; // Validity date (YYYY-MM-DD)
  tipoOrden?: IOLOrderType; // Order type (default: precioLimite)
  monto?: number; // Optional: total amount for buy
}

export interface IOLOrderResponse {
  ok: boolean;
  numeroOperacion?: number; // Operation number if successful
  mensaje?: string; // Message (error or confirmation)
  error?: string; // Error message if failed
}

// Historical price data point
export interface IOLHistoricalPrice {
  fecha: string; // Date (YYYY-MM-DD)
  apertura: number; // Open
  maximo: number; // High
  minimo: number; // Low
  ultimoPrecio: number; // Close
  volumen?: number; // Volume
  montoOperado?: number; // Money volume
}

// Security/Instrument details
export interface IOLSecurityDetails {
  simbolo: string;
  descripcion: string;
  pais: string;
  mercado: string;
  tipo: string;
  plazo: string;
  moneda: string;
}

// Security with quote for listings
export interface IOLSecurityWithQuote {
  simbolo: string;
  descripcion: string;
  ultimoPrecio: number;
  variacionPorcentual: number;
  apertura?: number;
  maximo?: number;
  minimo?: number;
  cierreAnterior?: number;
  volumen?: number;
  montoOperado?: number;
  fechaHora?: string;
  moneda?: string; // Currency of the price (e.g. "USD", "ARS") — present in fallback data
}

// Instrument types available in IOL
export type IOLInstrumentType =
  | "cedears"
  | "acciones"
  | "aDRs"
  | "titulosPublicos"
  | "obligacionesNegociables"
  | "letras"
  | "cauciones"
  | "opciones"
  | "futuros"
  | "cHPD";

// MEP Dollar types
export interface IOLMepPair {
  bond: string;
  arsSymbol: string;
  usdSymbol: string;
  arsPrice: number;
  usdPrice: number;
  implicitRate: number;
}

export interface IOLMepRates {
  pairs: IOLMepPair[];
  averageRate: number;
  timestamp: string;
}

// FCI (Fondos Comunes de Inversión) types
export interface IOLFCIFund {
  simbolo: string;
  descripcion: string;
  moneda: string;
  tipoFondo: string;
  administradora: string;
  ultimoOperado?: number;
  variacionPorcentual?: number;
  horizonteInversion?: string;
}

export interface IOLFCIDetails extends IOLFCIFund {
  perfilInversor?: string;
  objetivoInversion?: string;
  patrimonio?: number;
  rentabilidadAnual?: number;
  rentabilidadMensual?: number;
  comisionAdministracion?: number;
  montoMinimo?: number;
  plazosRescate?: string;
}

export interface IOLFCIType {
  tipo: string;
  descripcion: string;
}

export interface IOLFCIManager {
  nombre: string;
  descripcion?: string;
}
