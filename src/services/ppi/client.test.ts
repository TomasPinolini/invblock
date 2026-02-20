import { describe, it, expect, vi, beforeEach } from "vitest";
import { PPIClient, PPITokenExpiredError } from "./client";
import type {
  PPICredentials,
  PPIBalancesAndPositions,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid set of PPI credentials */
function makeCredentials(
  overrides: Partial<PPICredentials> = {}
): PPICredentials {
  return {
    apiKey: "test-api-key",
    apiSecret: "test-api-secret",
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    ...overrides,
  };
}

/** Shorthand for building a mock Response */
function mockResponse(
  body: unknown,
  init: { status?: number; ok?: boolean } = {}
): Response {
  const status = init.status ?? 200;
  const ok = init.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers(),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("PPIClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  // -----------------------------------------------------------------------
  // 1. Authentication
  // -----------------------------------------------------------------------
  describe("static authenticate", () => {
    it("returns credentials with accessToken on success", async () => {
      const loginResponse = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        creationDate: "2026-02-19T12:00:00Z",
        expirationDate: "2026-02-19T13:00:00Z",
      };

      fetchMock.mockResolvedValueOnce(mockResponse(loginResponse));

      const creds = await PPIClient.authenticate(
        "my-api-key",
        "my-api-secret"
      );

      expect(creds.accessToken).toBe("new-access-token");
      expect(creds.refreshToken).toBe("new-refresh-token");
      expect(creds.apiKey).toBe("my-api-key");
      expect(creds.apiSecret).toBe("my-api-secret");
    });

    it("handles PascalCase response fields (AccessToken)", async () => {
      const loginResponse = {
        AccessToken: "pascal-access-token",
        RefreshToken: "pascal-refresh-token",
      };

      fetchMock.mockResolvedValueOnce(mockResponse(loginResponse));

      const creds = await PPIClient.authenticate("key", "secret");

      expect(creds.accessToken).toBe("pascal-access-token");
      expect(creds.refreshToken).toBe("pascal-refresh-token");
    });

    it("throws on authentication failure", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse("Invalid credentials", { status: 401 })
      );

      await expect(
        PPIClient.authenticate("bad", "creds")
      ).rejects.toThrow("PPI authentication failed (401)");
    });

    it("throws when response is missing accessToken", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ unexpectedField: "value" })
      );

      await expect(
        PPIClient.authenticate("key", "secret")
      ).rejects.toThrow("response missing accessToken");
    });

    it("sends correct PPI headers", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ accessToken: "tok", refreshToken: "ref" })
      );

      await PPIClient.authenticate("my-key", "my-secret");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/api/1.0/Account/LoginApi");
      expect(init.headers.ApiKey).toBe("my-key");
      expect(init.headers.ApiSecret).toBe("my-secret");
      expect(init.headers.AuthorizedClient).toBe("API_CLI_REST");
      expect(init.headers.ClientKey).toBe("ppApiCliSB");
    });
  });

  // -----------------------------------------------------------------------
  // 2. Token refresh on 401
  // -----------------------------------------------------------------------
  describe("token refresh on 401", () => {
    it("refreshes the token and retries when the first request returns 401", async () => {
      const creds = makeCredentials();
      const client = new PPIClient(creds);

      const refreshedTokens = {
        accessToken: "refreshed-access-token",
        refreshToken: "refreshed-refresh-token",
      };

      const balancesData: PPIBalancesAndPositions = {
        Positions: [],
        CashBalances: [
          {
            Currency: "ARS",
            Settlement: "INMEDIATA",
            Amount: 100000,
            Available: 95000,
            Committed: 5000,
          },
        ],
      };

      // Call 1: original request -> 401
      // Call 2: refresh token -> 200
      // Call 3: retried request -> 200 with data
      fetchMock
        .mockResolvedValueOnce(mockResponse({}, { status: 401 }))
        .mockResolvedValueOnce(mockResponse(refreshedTokens))
        .mockResolvedValueOnce(mockResponse(balancesData));

      const result = await client.getBalancesAndPositions("12345");

      expect(result).toEqual(balancesData);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Verify the refresh call went to RefreshToken endpoint
      const refreshCall = fetchMock.mock.calls[1];
      expect(refreshCall[0]).toContain("/api/1.0/Account/RefreshToken");

      // Verify the retried call uses the refreshed token
      const retryCall = fetchMock.mock.calls[2];
      expect(retryCall[1]?.headers?.Authorization).toBe(
        "Bearer refreshed-access-token"
      );
    });

    it("throws PPITokenExpiredError when refresh itself fails", async () => {
      const creds = makeCredentials();
      const client = new PPIClient(creds);

      // Call 1: original request -> 401
      // Call 2: refresh token -> 401 (expired)
      fetchMock
        .mockResolvedValueOnce(mockResponse({}, { status: 401 }))
        .mockResolvedValueOnce(mockResponse({}, { status: 401 }));

      await expect(
        client.getBalancesAndPositions("12345")
      ).rejects.toThrow(PPITokenExpiredError);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws PPITokenExpiredError when there is no refresh token", async () => {
      const creds = makeCredentials({ refreshToken: "" });
      const client = new PPIClient(creds);

      // Call 1: original request -> 401
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 401 }));

      await expect(
        client.getBalancesAndPositions("12345")
      ).rejects.toThrow(PPITokenExpiredError);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Retry guard — no infinite recursion
  // -----------------------------------------------------------------------
  describe("retry guard (retried parameter)", () => {
    it("does NOT retry a second time after the first retry also returns 401", async () => {
      const creds = makeCredentials();
      const client = new PPIClient(creds);

      const refreshedTokens = {
        accessToken: "refreshed-access-token",
        refreshToken: "refreshed-refresh-token",
      };

      // Call 1: original request -> 401
      // Call 2: refresh token -> 200
      // Call 3: retried request -> 401 again
      fetchMock
        .mockResolvedValueOnce(mockResponse({}, { status: 401 }))
        .mockResolvedValueOnce(mockResponse(refreshedTokens))
        .mockResolvedValueOnce(mockResponse("Still unauthorized", { status: 401 }));

      await expect(
        client.getBalancesAndPositions("12345")
      ).rejects.toThrow("PPI API error: 401");

      // Must be exactly 3 calls: original, refresh, one retry — no further attempts
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  // -----------------------------------------------------------------------
  // 4. getBalancesAndPositions
  // -----------------------------------------------------------------------
  describe("getBalancesAndPositions", () => {
    it("returns data on success with explicit account number", async () => {
      const creds = makeCredentials();
      const client = new PPIClient(creds);

      const data: PPIBalancesAndPositions = {
        Positions: [
          {
            Ticker: "GGAL",
            Description: "Grupo Financiero Galicia",
            Currency: "ARS",
            Price: 3500,
            Quantity: 100,
            Amount: 350000,
            AveragePrice: 3200,
            PnL: 30000,
            PnLPercentage: 9.38,
            InstrumentType: "ACCIONES",
            Market: "BYMA",
            Settlement: "A-48HS",
          },
        ],
        CashBalances: [
          {
            Currency: "ARS",
            Settlement: "INMEDIATA",
            Amount: 500000,
            Available: 450000,
            Committed: 50000,
          },
          {
            Currency: "USD",
            Settlement: "A-48HS",
            Amount: 1000,
            Available: 1000,
            Committed: 0,
          },
        ],
      };

      fetchMock.mockResolvedValueOnce(mockResponse(data));

      const result = await client.getBalancesAndPositions("ACC-123");

      expect(result).toEqual(data);
      expect(result.Positions).toHaveLength(1);
      expect(result.Positions[0].Ticker).toBe("GGAL");
      expect(result.CashBalances).toHaveLength(2);
    });

    it("calls the correct endpoint with account number", async () => {
      const creds = makeCredentials();
      const client = new PPIClient(creds);

      fetchMock.mockResolvedValueOnce(
        mockResponse({ Positions: [], CashBalances: [] })
      );

      await client.getBalancesAndPositions("ACC-456");

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain(
        "/api/1.0/Account/BalancesAndPositions?accountNumber=ACC-456"
      );
    });

    it("fetches account number when none is provided", async () => {
      const creds = makeCredentials();
      const client = new PPIClient(creds);

      // Call 1: getAccountNumber -> returns accounts list
      // Call 2: getBalancesAndPositions with resolved account number
      fetchMock
        .mockResolvedValueOnce(
          mockResponse([{ AccountNumber: "AUTO-789" }])
        )
        .mockResolvedValueOnce(
          mockResponse({ Positions: [], CashBalances: [] })
        );

      await client.getBalancesAndPositions();

      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Second call should include the auto-resolved account number
      const balancesUrl = fetchMock.mock.calls[1][0] as string;
      expect(balancesUrl).toContain("accountNumber=AUTO-789");
    });

    it("includes Bearer token in Authorization header", async () => {
      const creds = makeCredentials({ accessToken: "my-ppi-token" });
      const client = new PPIClient(creds);

      fetchMock.mockResolvedValueOnce(
        mockResponse({ Positions: [], CashBalances: [] })
      );

      await client.getBalancesAndPositions("12345");

      expect(fetchMock.mock.calls[0][1]?.headers?.Authorization).toBe(
        "Bearer my-ppi-token"
      );
    });
  });

  // -----------------------------------------------------------------------
  // Error response parsing
  // -----------------------------------------------------------------------
  describe("error response parsing", () => {
    it("throws with the status code for non-OK, non-401 responses", async () => {
      const creds = makeCredentials();
      const client = new PPIClient(creds);

      fetchMock.mockResolvedValueOnce(
        mockResponse("Internal Server Error", { status: 500 })
      );

      await expect(
        client.getBalancesAndPositions("12345")
      ).rejects.toThrow("PPI API error: 500");
    });

    it("throws with status 403 without attempting refresh", async () => {
      const creds = makeCredentials();
      const client = new PPIClient(creds);

      fetchMock.mockResolvedValueOnce(
        mockResponse("Forbidden", { status: 403 })
      );

      await expect(
        client.getBalancesAndPositions("12345")
      ).rejects.toThrow("PPI API error: 403");

      // 403 is NOT 401, so no refresh attempt — only 1 fetch call
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws when client has no access token", async () => {
      const creds = makeCredentials({ accessToken: "" });
      const client = new PPIClient(creds);

      await expect(
        client.getBalancesAndPositions("12345")
      ).rejects.toThrow("Not authenticated with PPI");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getCredentials / setCredentials
  // -----------------------------------------------------------------------
  describe("getCredentials", () => {
    it("returns a copy of the current credentials", () => {
      const creds = makeCredentials();
      const client = new PPIClient(creds);
      const result = client.getCredentials();

      expect(result).toEqual(creds);
      // Should be a copy, not the same reference
      expect(result).not.toBe(creds);
    });

    it("reflects refreshed credentials after a 401 refresh cycle", async () => {
      const creds = makeCredentials();
      const client = new PPIClient(creds);

      const refreshedTokens = {
        accessToken: "after-refresh-access",
        refreshToken: "after-refresh-refresh",
      };

      // Call 1: original request -> 401
      // Call 2: refresh token -> 200
      // Call 3: retried request -> 200
      fetchMock
        .mockResolvedValueOnce(mockResponse({}, { status: 401 }))
        .mockResolvedValueOnce(mockResponse(refreshedTokens))
        .mockResolvedValueOnce(
          mockResponse({ Positions: [], CashBalances: [] })
        );

      await client.getBalancesAndPositions("12345");

      const updatedCreds = client.getCredentials();
      expect(updatedCreds.accessToken).toBe("after-refresh-access");
      expect(updatedCreds.refreshToken).toBe("after-refresh-refresh");
      // apiKey and apiSecret should remain unchanged
      expect(updatedCreds.apiKey).toBe("test-api-key");
      expect(updatedCreds.apiSecret).toBe("test-api-secret");
    });
  });
});
