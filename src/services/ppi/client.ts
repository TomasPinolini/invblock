import type {
  PPICredentials,
  PPILoginResponse,
  PPIBalancesAndPositions,
  PPIAvailableBalance,
  PPIQuote,
  PPIInstrument,
  PPIAccount,
} from "./types";

const PPI_API_BASE =
  process.env.PPI_API_URL || "https://clientapi_sandbox.portfoliopersonal.com";

export class PPITokenExpiredError extends Error {
  constructor() {
    super("PPI session expired. Please reconnect your account.");
    this.name = "PPITokenExpiredError";
  }
}

/** Build the static PPI headers — only includes ApiSecret if present */
function buildPPIHeaders(creds: {
  authorizedClient: string;
  clientKey: string;
  apiKey: string;
  apiSecret?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    AuthorizedClient: creds.authorizedClient,
    ClientKey: creds.clientKey,
    ApiKey: creds.apiKey,
  };
  if (creds.apiSecret) {
    headers.ApiSecret = creds.apiSecret;
  }
  return headers;
}

export class PPIClient {
  private credentials: PPICredentials;

  constructor(credentials: PPICredentials) {
    this.credentials = credentials;
  }

  /**
   * Authenticate with PPI using API keys.
   * Returns credentials object with tokens for future API calls.
   */
  static async authenticate(
    authorizedClient: string,
    clientKey: string,
    apiKey: string,
    apiSecret?: string
  ): Promise<PPICredentials> {
    const response = await fetch(`${PPI_API_BASE}/api/1.0/Account/LoginApi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildPPIHeaders({ authorizedClient, clientKey, apiKey, apiSecret }),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `PPI authentication failed: ${response.status} ${text}`
      );
    }

    const data: PPILoginResponse = await response.json();

    return {
      authorizedClient,
      clientKey,
      apiKey,
      apiSecret,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  }

  /**
   * Refresh the access token
   */
  private async refreshToken(): Promise<void> {
    if (!this.credentials.refreshToken) {
      throw new PPITokenExpiredError();
    }

    const response = await fetch(
      `${PPI_API_BASE}/api/1.0/Account/RefreshToken`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildPPIHeaders(this.credentials),
        },
        body: JSON.stringify({
          refreshToken: this.credentials.refreshToken,
        }),
      }
    );

    if (!response.ok) {
      throw new PPITokenExpiredError();
    }

    const data: PPILoginResponse = await response.json();
    this.credentials.accessToken = data.accessToken;
    this.credentials.refreshToken = data.refreshToken;
  }

  /**
   * Make authenticated API request.
   * Sends static PPI headers + Bearer token on every call.
   */
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    if (!this.credentials.accessToken) {
      throw new Error("Not authenticated with PPI");
    }

    const response = await fetch(`${PPI_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...options?.headers,
        ...buildPPIHeaders(this.credentials),
        Authorization: `Bearer ${this.credentials.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try refreshing token once
        await this.refreshToken();
        return this.request(endpoint, options);
      }
      throw new Error(`PPI API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get portfolio positions and cash balances
   */
  async getBalancesAndPositions(): Promise<PPIBalancesAndPositions> {
    return this.request<PPIBalancesAndPositions>(
      "/api/1.0/Account/BalancesAndPositions"
    );
  }

  /**
   * Get available balance per currency and settlement
   */
  async getAvailableBalance(): Promise<PPIAvailableBalance> {
    return this.request<PPIAvailableBalance>(
      "/api/1.0/Account/AvailableBalance"
    );
  }

  /**
   * Get account information
   */
  async getAccounts(): Promise<PPIAccount[]> {
    return this.request<PPIAccount[]>("/api/1.0/Account/Accounts");
  }

  /**
   * Get real-time quote for a single instrument
   */
  async getQuote(
    ticker: string,
    type: string,
    settlement: string = "A-48HS"
  ): Promise<PPIQuote> {
    const params = new URLSearchParams({ ticker, type, settlement });
    return this.request<PPIQuote>(
      `/api/1.0/MarketData/Current?${params.toString()}`
    );
  }

  /**
   * Get quotes for multiple instruments
   * Returns a map of ticker -> quote (null if failed)
   */
  async getQuotes(
    tickers: Array<{ ticker: string; type: string; settlement?: string }>
  ): Promise<Map<string, PPIQuote | null>> {
    const results = new Map<string, PPIQuote | null>();

    const promises = tickers.map(
      async ({ ticker, type, settlement = "A-48HS" }) => {
        try {
          const quote = await this.getQuote(ticker, type, settlement);
          results.set(ticker.toUpperCase(), quote);
        } catch {
          results.set(ticker.toUpperCase(), null);
        }
      }
    );

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Search instruments
   */
  async searchInstruments(
    ticker: string,
    filter?: string,
    market?: string,
    type?: string
  ): Promise<PPIInstrument[]> {
    const params = new URLSearchParams({ ticker });
    if (filter) params.set("filter", filter);
    if (market) params.set("market", market);
    if (type) params.set("type", type);

    return this.request<PPIInstrument[]>(
      `/api/1.0/MarketData/SearchInstrument?${params.toString()}`
    );
  }

  /**
   * Get current credentials (for storage after token refresh)
   */
  getCredentials(): PPICredentials {
    return { ...this.credentials };
  }

  /**
   * Set credentials (from storage)
   */
  setCredentials(credentials: PPICredentials): void {
    this.credentials = credentials;
  }
}
