import type {
  IOLToken,
  IOLPortfolio,
  IOLAccountState,
  IOLOperation,
  IOLNotification,
  IOLQuote,
  IOLOrderRequest,
  IOLOrderResponse,
  IOLHistoricalPrice,
  IOLSecurityDetails,
  IOLSecurityWithQuote,
  IOLInstrumentType,
  IOLMepPair,
  IOLMepRates,
  IOLFCIFund,
  IOLFCIDetails,
  IOLFCIType,
} from "./types";

const IOL_API_BASE = "https://api.invertironline.com";

// Custom error for token expiration - signals need to re-authenticate
export class IOLTokenExpiredError extends Error {
  constructor() {
    super("IOL session expired. Please reconnect your account.");
    this.name = "IOLTokenExpiredError";
  }
}

export class IOLClient {
  private token: IOLToken | null = null;

  constructor(token?: IOLToken) {
    this.token = token ?? null;
  }

  /**
   * Authenticate with IOL using username and password
   * Returns tokens for future API calls
   */
  static async authenticate(
    username: string,
    password: string
  ): Promise<IOLToken> {
    const url = `${IOL_API_BASE}/token`;
    console.log("[IOL Auth] POST", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username,
        password,
        grant_type: "password",
      }),
    });

    const text = await response.text();
    console.log("[IOL Auth] Response status:", response.status);
    console.log("[IOL Auth] Response headers:", JSON.stringify(Object.fromEntries(response.headers.entries())));
    console.log("[IOL Auth] Response body:", text.slice(0, 500));

    if (!response.ok) {
      throw new Error(
        `IOL authentication failed (${response.status}): ${text.slice(0, 200)}`
      );
    }

    const token: IOLToken = JSON.parse(text);
    token.issued_at = Date.now();
    return token;
  }

  /**
   * Refresh the access token using refresh_token
   */
  async refreshToken(): Promise<IOLToken> {
    if (!this.token?.refresh_token) {
      throw new Error("No refresh token available");
    }

    const response = await fetch(`${IOL_API_BASE}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        refresh_token: this.token.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      // Refresh token expired or invalid - user needs to re-authenticate
      throw new IOLTokenExpiredError();
    }

    const newToken: IOLToken = await response.json();
    newToken.issued_at = Date.now();
    this.token = newToken;
    return newToken;
  }

  /**
   * Check if token is expired (with 5 min buffer)
   */
  isTokenExpired(): boolean {
    if (!this.token?.issued_at) return true;
    const expiresAt = this.token.issued_at + this.token.expires_in * 1000;
    return Date.now() > expiresAt - 5 * 60 * 1000; // 5 min buffer
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    if (!this.token) {
      throw new Error("Not authenticated with IOL");
    }

    // Refresh token if expired
    if (this.isTokenExpired()) {
      await this.refreshToken();
    }

    const response = await fetch(`${IOL_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${this.token.access_token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try refreshing token once
        await this.refreshToken();
        return this.request(endpoint, options);
      }
      throw new Error(`IOL API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get portfolio holdings
   * @param country - "argentina" or "estados_unidos"
   */
  async getPortfolio(
    country: "argentina" | "estados_unidos" = "argentina"
  ): Promise<IOLPortfolio> {
    return this.request<IOLPortfolio>(`/api/v2/portafolio/${country}`);
  }

  /**
   * Get all portfolios (Argentina + US)
   */
  async getAllPortfolios(): Promise<{
    argentina: IOLPortfolio;
    us: IOLPortfolio;
  }> {
    const [argentina, us] = await Promise.all([
      this.getPortfolio("argentina"),
      this.getPortfolio("estados_unidos"),
    ]);
    return { argentina, us };
  }

  /**
   * Get account state (balances)
   */
  async getAccountState(): Promise<IOLAccountState> {
    return this.request<IOLAccountState>("/api/v2/estadocuenta");
  }

  /**
   * Get recent operations/transactions
   * @param status - "todas", "pendientes", "canceladas", "terminadas"
   */
  async getOperations(
    status: "todas" | "pendientes" | "canceladas" | "terminadas" = "terminadas",
    from?: Date,
    to?: Date
  ): Promise<IOLOperation[]> {
    const params = new URLSearchParams();
    params.set("filtro.estado", status);

    if (from) {
      params.set("filtro.fechaDesde", from.toISOString().split("T")[0]);
    }
    if (to) {
      params.set("filtro.fechaHasta", to.toISOString().split("T")[0]);
    }

    return this.request<IOLOperation[]>(
      `/api/v2/operaciones?${params.toString()}`
    );
  }

  /**
   * Get notifications from IOL
   */
  async getNotifications(): Promise<IOLNotification[]> {
    return this.request<IOLNotification[]>("/api/v2/Notificacion");
  }

  /**
   * Get real-time quote for a security
   * @param market - bCBA, nYSE, nASDAQ, aMEX, bCS, rOFX
   * @param symbol - Ticker (e.g., "GGAL", "AAPL", "KO")
   */
  async getQuote(market: string, symbol: string): Promise<IOLQuote> {
    return this.request<IOLQuote>(
      `/api/v2/${market}/Titulos/${symbol}/Cotizacion`
    );
  }

  /**
   * Get quotes for multiple securities
   * Returns a map of ticker -> quote (null if failed)
   */
  async getQuotes(
    tickers: Array<{ market: string; symbol: string }>
  ): Promise<Map<string, IOLQuote | null>> {
    const results = new Map<string, IOLQuote | null>();

    // Fetch all quotes in parallel
    const promises = tickers.map(async ({ market, symbol }) => {
      try {
        const quote = await this.getQuote(market, symbol);
        results.set(symbol.toUpperCase(), quote);
      } catch {
        results.set(symbol.toUpperCase(), null);
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Place a buy order
   * @param order - Order details (market, symbol, quantity, price, settlement, validity)
   */
  async placeBuyOrder(order: IOLOrderRequest): Promise<IOLOrderResponse> {
    const body = {
      mercado: order.mercado,
      simbolo: order.simbolo,
      cantidad: order.cantidad,
      precio: order.precio,
      plazo: order.plazo,
      validez: order.validez,
      tipoOrden: order.tipoOrden || "precioLimite",
    };

    try {
      const result = await this.request<{ numeroOperacion?: number; mensaje?: string }>(
        "/api/v2/operar/Comprar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      return {
        ok: true,
        numeroOperacion: result.numeroOperacion,
        mensaje: result.mensaje || "Orden de compra enviada",
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Error al enviar orden de compra",
      };
    }
  }

  /**
   * Place a sell order
   * @param order - Order details (market, symbol, quantity, price, settlement, validity)
   */
  async placeSellOrder(order: IOLOrderRequest): Promise<IOLOrderResponse> {
    const body = {
      mercado: order.mercado,
      simbolo: order.simbolo,
      cantidad: order.cantidad,
      precio: order.precio,
      plazo: order.plazo,
      validez: order.validez,
      tipoOrden: order.tipoOrden || "precioLimite",
    };

    try {
      const result = await this.request<{ numeroOperacion?: number; mensaje?: string }>(
        "/api/v2/operar/Vender",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      return {
        ok: true,
        numeroOperacion: result.numeroOperacion,
        mensaje: result.mensaje || "Orden de venta enviada",
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Error al enviar orden de venta",
      };
    }
  }

  /**
   * Get historical prices for a security
   * @param market - bCBA, nYSE, nASDAQ, etc.
   * @param symbol - Ticker symbol
   * @param from - Start date (YYYY-MM-DD)
   * @param to - End date (YYYY-MM-DD)
   * @param adjusted - Whether to adjust for splits/dividends
   */
  async getHistoricalPrices(
    market: string,
    symbol: string,
    from: string,
    to: string,
    adjusted: boolean = true
  ): Promise<IOLHistoricalPrice[]> {
    const adjustedParam = adjusted ? "ajustada" : "sinAjustar";
    return this.request<IOLHistoricalPrice[]>(
      `/api/v2/${market}/Titulos/${symbol}/Cotizacion/seriehistorica/${from}/${to}/${adjustedParam}`
    );
  }

  /**
   * Cancel a pending order
   * @param operationNumber - The operation number to cancel
   */
  async cancelOrder(operationNumber: number): Promise<IOLOrderResponse> {
    try {
      await this.request<void>(`/api/v2/operaciones/${operationNumber}`, {
        method: "DELETE",
      });

      return {
        ok: true,
        mensaje: `Orden ${operationNumber} cancelada`,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Error al cancelar orden",
      };
    }
  }

  /**
   * Get security details
   * @param market - bCBA, nYSE, nASDAQ, etc.
   * @param symbol - Ticker symbol
   */
  async getSecurityDetails(
    market: string,
    symbol: string
  ): Promise<IOLSecurityDetails> {
    return this.request<IOLSecurityDetails>(
      `/api/v2/${market}/Titulos/${symbol}`
    );
  }

  /**
   * List instruments/securities with quotes
   * @param country - "argentina" or "estados_Unidos"
   * @param instrumentType - cedears, acciones, etc. (optional)
   */
  async listInstruments(
    country: "argentina" | "estados_Unidos" = "argentina",
    instrumentType?: IOLInstrumentType
  ): Promise<IOLSecurityWithQuote[]> {
    // For acciones, try the panels endpoint (more reliable for stocks)
    if (country === "argentina" && instrumentType === "acciones") {
      try {
        // Try Lideres panel first
        return await this.getPanel("Lideres");
      } catch {
        try {
          // Then try General panel
          return await this.getPanel("General");
        } catch {
          // Fall through to instruments endpoint
        }
      }
    }

    // Use instruments endpoint for CEDEARs and other types
    const endpoint = instrumentType
      ? `/api/v2/${country}/Titulos/Cotizacion/Instrumentos/${instrumentType}`
      : `/api/v2/${country}/Titulos/Cotizacion/Instrumentos`;
    return this.request<IOLSecurityWithQuote[]>(endpoint);
  }

  /**
   * Search securities by panel (BCBA panels)
   * @param panel - Panel name (e.g., "Lideres", "General")
   */
  async getPanel(
    panel: string
  ): Promise<IOLSecurityWithQuote[]> {
    return this.request<IOLSecurityWithQuote[]>(
      `/api/v2/Cotizaciones/acciones/argentina/${panel}`
    );
  }

  /**
   * Calculate implicit MEP dollar rate from bond pair quotes.
   * MEP Rate = ARS bond price / USD bond price
   */
  async getMepRates(): Promise<IOLMepRates> {
    const bondPairs = [
      { bond: "AL30", arsSymbol: "AL30", usdSymbol: "AL30D" },
      { bond: "GD30", arsSymbol: "GD30", usdSymbol: "GD30D" },
      { bond: "AE38", arsSymbol: "AE38", usdSymbol: "AE38D" },
    ];

    const pairs: IOLMepPair[] = [];

    await Promise.allSettled(
      bondPairs.map(async ({ bond, arsSymbol, usdSymbol }) => {
        try {
          const [arsQuote, usdQuote] = await Promise.all([
            this.getQuote("bCBA", arsSymbol),
            this.getQuote("bCBA", usdSymbol),
          ]);

          if (arsQuote?.ultimoPrecio > 0 && usdQuote?.ultimoPrecio > 0) {
            pairs.push({
              bond,
              arsSymbol,
              usdSymbol,
              arsPrice: arsQuote.ultimoPrecio,
              usdPrice: usdQuote.ultimoPrecio,
              implicitRate: arsQuote.ultimoPrecio / usdQuote.ultimoPrecio,
            });
          }
        } catch {
          // Skip pairs that fail (market closed, no liquidity)
        }
      })
    );

    const averageRate =
      pairs.length > 0
        ? pairs.reduce((sum, p) => sum + p.implicitRate, 0) / pairs.length
        : 0;

    return {
      pairs,
      averageRate,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * List all FCIs (Fondos Comunes de Inversión)
   */
  async listFCIs(): Promise<IOLFCIFund[]> {
    return this.request<IOLFCIFund[]>("/api/v2/Titulos/FCI");
  }

  /**
   * Get FCI details by symbol
   */
  async getFCIDetails(symbol: string): Promise<IOLFCIDetails> {
    return this.request<IOLFCIDetails>(`/api/v2/Titulos/FCI/${encodeURIComponent(symbol)}`);
  }

  /**
   * Get FCI fund type categories
   */
  async getFCITypes(): Promise<IOLFCIType[]> {
    return this.request<IOLFCIType[]>("/api/v2/Titulos/FCI/TipoFondos");
  }

  /**
   * Get current token (for storage)
   */
  getToken(): IOLToken | null {
    return this.token;
  }

  /**
   * Set token (from storage)
   */
  setToken(token: IOLToken): void {
    this.token = token;
  }
}
