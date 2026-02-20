import { describe, it, expect, vi, beforeEach } from "vitest";
import { IOLClient, IOLTokenExpiredError } from "./client";
import type { IOLToken, IOLPortfolio, IOLQuote } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid IOL token that is NOT expired (issued_at = now, expires in 1h) */
function makeToken(overrides: Partial<IOLToken> = {}): IOLToken {
  return {
    access_token: "test-access-token",
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "test-refresh-token",
    issued_at: Date.now(),
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

describe("IOLClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  // -----------------------------------------------------------------------
  // 1. Token refresh on 401
  // -----------------------------------------------------------------------
  describe("token refresh on 401", () => {
    it("refreshes the token and retries when the first request returns 401", async () => {
      const token = makeToken();
      const client = new IOLClient(token);

      const refreshedToken: IOLToken = {
        access_token: "refreshed-access-token",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "refreshed-refresh-token",
      };

      const portfolioData: IOLPortfolio = {
        pais: "argentina",
        activos: [],
      };

      // Call 1: original request -> 401
      // Call 2: refresh token request -> 200 with new token
      // Call 3: retried request -> 200 with portfolio
      fetchMock
        .mockResolvedValueOnce(mockResponse({}, { status: 401 }))
        .mockResolvedValueOnce(mockResponse(refreshedToken))
        .mockResolvedValueOnce(mockResponse(portfolioData));

      const result = await client.getPortfolio();

      expect(result).toEqual(portfolioData);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Verify the refresh call went to /token
      const refreshCall = fetchMock.mock.calls[1];
      expect(refreshCall[0]).toBe("https://api.invertironline.com/token");

      // Verify the retried call used the refreshed token
      const retryCall = fetchMock.mock.calls[2];
      expect(retryCall[1]?.headers?.Authorization).toBe(
        "Bearer refreshed-access-token"
      );
    });

    it("throws IOLTokenExpiredError when refresh itself fails", async () => {
      const token = makeToken();
      const client = new IOLClient(token);

      // Call 1: original request -> 401
      // Call 2: refresh token -> 401 (expired refresh token)
      fetchMock
        .mockResolvedValueOnce(mockResponse({}, { status: 401 }))
        .mockResolvedValueOnce(mockResponse({}, { status: 401 }));

      await expect(client.getPortfolio()).rejects.toThrow(
        IOLTokenExpiredError
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Retry guard — no infinite recursion
  // -----------------------------------------------------------------------
  describe("retry guard (retried parameter)", () => {
    it("does NOT retry a second time after the first retry also returns 401", async () => {
      const token = makeToken();
      const client = new IOLClient(token);

      const refreshedToken: IOLToken = {
        access_token: "refreshed-access-token",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "refreshed-refresh-token",
      };

      // Call 1: original request -> 401
      // Call 2: refresh token -> 200
      // Call 3: retried request -> 401 again (even after refresh)
      fetchMock
        .mockResolvedValueOnce(mockResponse({}, { status: 401 }))
        .mockResolvedValueOnce(mockResponse(refreshedToken))
        .mockResolvedValueOnce(mockResponse({}, { status: 401 }));

      await expect(client.getPortfolio()).rejects.toThrow(
        "IOL API error: 401"
      );

      // Must be exactly 3 calls: original, refresh, one retry — no further attempts
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Error response parsing
  // -----------------------------------------------------------------------
  describe("error response parsing", () => {
    it("throws with the status code in the message for non-OK responses", async () => {
      const token = makeToken();
      const client = new IOLClient(token);

      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 500 }));

      await expect(client.getPortfolio()).rejects.toThrow(
        "IOL API error: 500"
      );
    });

    it("throws with status 403 for forbidden responses (no retry)", async () => {
      const token = makeToken();
      const client = new IOLClient(token);

      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 403 }));

      await expect(client.getPortfolio()).rejects.toThrow(
        "IOL API error: 403"
      );
      // 403 is NOT 401, so no refresh attempt
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws when client has no token", async () => {
      const client = new IOLClient();

      await expect(client.getPortfolio()).rejects.toThrow(
        "Not authenticated with IOL"
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 4. getPortfolio
  // -----------------------------------------------------------------------
  describe("getPortfolio", () => {
    it("returns parsed portfolio data on success", async () => {
      const token = makeToken();
      const client = new IOLClient(token);

      const portfolioData: IOLPortfolio = {
        pais: "argentina",
        activos: [
          {
            cantidad: 100,
            comprometido: 0,
            puntosVariacion: 5.2,
            variacionDiaria: 1.5,
            ultimoPrecio: 3500,
            ppc: 3200,
            gananciaPorcentaje: 9.38,
            gananciaDinero: 30000,
            valorizado: 350000,
            titulo: {
              simbolo: "GGAL",
              descripcion: "Grupo Financiero Galicia",
              pais: "argentina",
              mercado: "bcba",
              tipo: "ACCIONES",
              plazo: "t2",
              moneda: "peso_Argentino",
            },
          },
        ],
        totalEnPesos: 350000,
      };

      fetchMock.mockResolvedValueOnce(mockResponse(portfolioData));

      const result = await client.getPortfolio();

      expect(result).toEqual(portfolioData);
      expect(result.activos).toHaveLength(1);
      expect(result.activos[0].titulo.simbolo).toBe("GGAL");
    });

    it("calls the correct endpoint for argentina", async () => {
      const token = makeToken();
      const client = new IOLClient(token);

      fetchMock.mockResolvedValueOnce(
        mockResponse({ pais: "argentina", activos: [] })
      );

      await client.getPortfolio("argentina");

      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.invertironline.com/api/v2/portafolio/argentina"
      );
    });

    it("calls the correct endpoint for US portfolio", async () => {
      const token = makeToken();
      const client = new IOLClient(token);

      fetchMock.mockResolvedValueOnce(
        mockResponse({ pais: "estados_unidos", activos: [] })
      );

      await client.getPortfolio("estados_unidos");

      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.invertironline.com/api/v2/portafolio/estados_unidos"
      );
    });
  });

  // -----------------------------------------------------------------------
  // 5. getQuote
  // -----------------------------------------------------------------------
  describe("getQuote", () => {
    it("returns quote data for a valid market and symbol", async () => {
      const token = makeToken();
      const client = new IOLClient(token);

      const quoteData: IOLQuote = {
        ultimoPrecio: 3450,
        variacion: -2.81,
        apertura: 3500,
        maximo: 3550,
        minimo: 3400,
        cierreAnterior: 3550,
        volumenNominal: 150000,
        montoOperado: 525000000,
        tendencia: "baja",
        fechaHora: "2026-02-19T15:30:00",
        moneda: "peso_Argentino",
        descripcionTitulo: "Grupo Financiero Galicia",
      };

      fetchMock.mockResolvedValueOnce(mockResponse(quoteData));

      const result = await client.getQuote("bCBA", "GGAL");

      expect(result).toEqual(quoteData);
      expect(result.ultimoPrecio).toBe(3450);
      expect(result.variacion).toBe(-2.81);
    });

    it("calls the correct endpoint with market and symbol", async () => {
      const token = makeToken();
      const client = new IOLClient(token);

      fetchMock.mockResolvedValueOnce(
        mockResponse({ ultimoPrecio: 100, variacion: 0, apertura: 100, maximo: 100, minimo: 100, cierreAnterior: 100 })
      );

      await client.getQuote("nYSE", "AAPL");

      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.invertironline.com/api/v2/nYSE/Titulos/AAPL/Cotizacion"
      );
    });

    it("includes Bearer token in the Authorization header", async () => {
      const token = makeToken({ access_token: "my-secret-token" });
      const client = new IOLClient(token);

      fetchMock.mockResolvedValueOnce(
        mockResponse({ ultimoPrecio: 100, variacion: 0, apertura: 100, maximo: 100, minimo: 100, cierreAnterior: 100 })
      );

      await client.getQuote("bCBA", "GGAL");

      expect(fetchMock.mock.calls[0][1]?.headers?.Authorization).toBe(
        "Bearer my-secret-token"
      );
    });
  });

  // -----------------------------------------------------------------------
  // static authenticate
  // -----------------------------------------------------------------------
  describe("static authenticate", () => {
    it("returns an IOLToken on success", async () => {
      const tokenResponse = {
        access_token: "new-access",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "new-refresh",
      };

      fetchMock.mockResolvedValueOnce(
        mockResponse(tokenResponse)
      );

      const token = await IOLClient.authenticate("user", "pass");

      expect(token.access_token).toBe("new-access");
      expect(token.refresh_token).toBe("new-refresh");
      expect(token.issued_at).toBeGreaterThan(0);
    });

    it("throws on authentication failure", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse("Invalid credentials", { status: 401 })
      );

      await expect(
        IOLClient.authenticate("bad", "creds")
      ).rejects.toThrow("IOL authentication failed (401)");
    });
  });

  // -----------------------------------------------------------------------
  // isTokenExpired
  // -----------------------------------------------------------------------
  describe("isTokenExpired", () => {
    it("returns false for a freshly issued token", () => {
      const token = makeToken({ issued_at: Date.now(), expires_in: 3600 });
      const client = new IOLClient(token);
      expect(client.isTokenExpired()).toBe(false);
    });

    it("returns true when the token is past its expiry (with 5-min buffer)", () => {
      // Issued 2 hours ago, expires_in = 3600 (1h) -> expired 1h ago
      const token = makeToken({
        issued_at: Date.now() - 2 * 60 * 60 * 1000,
        expires_in: 3600,
      });
      const client = new IOLClient(token);
      expect(client.isTokenExpired()).toBe(true);
    });

    it("returns true when no issued_at is set", () => {
      const token = makeToken({ issued_at: undefined });
      const client = new IOLClient(token);
      expect(client.isTokenExpired()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // proactive token refresh on expired token
  // -----------------------------------------------------------------------
  describe("proactive token refresh before request", () => {
    it("refreshes the token before making the request if token is expired", async () => {
      // Token that expired 2 hours ago
      const expiredToken = makeToken({
        issued_at: Date.now() - 2 * 60 * 60 * 1000,
        expires_in: 3600,
      });
      const client = new IOLClient(expiredToken);

      const refreshedToken: IOLToken = {
        access_token: "proactively-refreshed",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "new-refresh",
      };

      const portfolioData: IOLPortfolio = {
        pais: "argentina",
        activos: [],
      };

      // Call 1: refresh token (proactive)
      // Call 2: actual request with new token
      fetchMock
        .mockResolvedValueOnce(mockResponse(refreshedToken))
        .mockResolvedValueOnce(mockResponse(portfolioData));

      const result = await client.getPortfolio();

      expect(result).toEqual(portfolioData);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // First call should be the refresh
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.invertironline.com/token"
      );

      // Second call should use the refreshed token
      expect(fetchMock.mock.calls[1][1]?.headers?.Authorization).toBe(
        "Bearer proactively-refreshed"
      );
    });
  });
});
