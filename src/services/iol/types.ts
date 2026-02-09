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

export interface IOLAccountState {
  cuentas: {
    numero: string;
    tipo: string;
    moneda: string;
    disponible: number;
    comprometido: number;
    saldo: number;
  }[];
}

export interface IOLOperation {
  numero: number;
  fechaOrden: string;
  tipo: string;
  estado: string;
  mercado: string;
  simbolo: string;
  cantidad: number;
  precio: number;
  montoTotal: number;
  cantidadOperada?: number;
}
