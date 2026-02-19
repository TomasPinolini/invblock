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

// Fixed client identifiers for PPI REST API — NOT user credentials.
const PPI_AUTHORIZED_CLIENT =
  process.env.PPI_AUTHORIZED_CLIENT || "API_CLI_REST";
const PPI_CLIENT_KEY =
  process.env.PPI_CLIENT_KEY || "ppApiCliSB";

export class PPITokenExpiredError extends Error {
  constructor() {
    super("PPI session expired. Please reconnect your account.");
    this.name = "PPITokenExpiredError";
  }
}

/** Build PPI headers matching the official Python SDK */
function buildPPIHeaders(creds: {
  apiKey: string;
  apiSecret: string;
}): Record<string, string> {
  return {
    AuthorizedClient: PPI_AUTHORIZED_CLIENT,
    ClientKey: PPI_CLIENT_KEY,
    ApiKey: creds.apiKey,
    ApiSecret: creds.apiSecret,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
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
  /**
   * Authenticate with PPI using public key + private key.
   * AuthorizedClient and ClientKey are fixed SDK identifiers (not user input).
   */
  static async authenticate(
    apiKey: string,
    apiSecret: string
  ): Promise<PPICredentials> {
    const url = `${PPI_API_BASE}/api/1.0/Account/LoginApi`;
    const headers = buildPPIHeaders({ apiKey, apiSecret });

    console.log("[PPI Auth] POST", url);
    console.log("[PPI Auth] Headers:", Object.keys(headers).join(", "));

    const response = await fetch(url, {
      method: "POST",
      headers,
    });

    const text = await response.text().catch(() => "");
    console.log("[PPI Auth] Response status:", response.status);
    console.log("[PPI Auth] Response body:", text.slice(0, 500));

    if (!response.ok) {
      throw new Error(
        `PPI authentication failed (${response.status}): ${text.slice(0, 200)}`
      );
    }

    const data = JSON.parse(text);
    const accessToken = data.accessToken || data.AccessToken;
    const refreshToken = data.refreshToken || data.RefreshToken;

    if (!accessToken) {
      console.error("[PPI Auth] Unexpected response shape:", Object.keys(data));
      throw new Error(
        `PPI login succeeded but response missing accessToken. Keys: ${Object.keys(data).join(", ")}`
      );
    }

    return {
      apiKey,
      apiSecret,
      accessToken,
      refreshToken,
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
          ...buildPPIHeaders(this.credentials),
          Authorization: `Bearer ${this.credentials.accessToken}`,
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
    this.credentials.accessToken = data.accessToken || data.AccessToken;
    this.credentials.refreshToken = data.refreshToken || data.RefreshToken;
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
      const errorText = await response.text().catch(() => "");
      console.error(`[PPI API] ${endpoint} failed (${response.status}):`, errorText.slice(0, 300));
      throw new Error(`PPI API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    return response.json();
  }

  /**
   * Get account number (needed for most PPI endpoints)
   */
  async getAccountNumber(): Promise<string> {
    const accounts = await this.request<Record<string, unknown>[]>("/api/1.0/Account/Accounts");
    console.log("[PPI Accounts] Response:", JSON.stringify(accounts).slice(0, 500));
    if (!accounts || accounts.length === 0) {
      throw new Error("No PPI accounts found");
    }
    // Handle both camelCase and PascalCase
    const acct = accounts[0];
    const accountNumber = acct.AccountNumber || acct.accountNumber || acct.account_number;
    if (!accountNumber) {
      console.error("[PPI Accounts] Unknown shape, keys:", Object.keys(acct));
      throw new Error(`PPI account missing accountNumber. Keys: ${Object.keys(acct).join(", ")}`);
    }
    return String(accountNumber);
  }

  /**
   * Get portfolio positions and cash balances
   */
  async getBalancesAndPositions(accountNumber?: string): Promise<PPIBalancesAndPositions> {
    const acct = accountNumber || await this.getAccountNumber();
    return this.request<PPIBalancesAndPositions>(
      `/api/1.0/Account/BalancesAndPositions?accountNumber=${acct}`
    );
  }

  /**
   * Get available balance per currency and settlement
   */
  async getAvailableBalance(accountNumber?: string): Promise<PPIAvailableBalance> {
    const acct = accountNumber || await this.getAccountNumber();
    return this.request<PPIAvailableBalance>(
      `/api/1.0/Account/AvailableBalance?accountNumber=${acct}`
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
