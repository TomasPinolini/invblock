import type {
  IOLToken,
  IOLPortfolio,
  IOLAccountState,
  IOLOperation,
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
    const response = await fetch(`${IOL_API_BASE}/token`, {
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

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`IOL authentication failed: ${error}`);
    }

    const token: IOLToken = await response.json();
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
    const params = new URLSearchParams({ filtro: { estado: status } as any });

    if (from) {
      params.set("fechaDesde", from.toISOString().split("T")[0]);
    }
    if (to) {
      params.set("fechaHasta", to.toISOString().split("T")[0]);
    }

    return this.request<IOLOperation[]>(
      `/api/v2/operaciones?${params.toString()}`
    );
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
