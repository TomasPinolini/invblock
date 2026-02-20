import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock getAuthUser
const mockGetAuthUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAuthUser: () => mockGetAuthUser(),
}));

// Mock checkRateLimit
const mockCheckRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  RATE_LIMITS: {
    trade: { limit: 5, windowSeconds: 60 },
  },
}));

// Mock decryptCredentials / encryptCredentials
const mockDecryptCredentials = vi.fn();
const mockEncryptCredentials = vi.fn();
vi.mock("@/lib/crypto", () => ({
  decryptCredentials: (...args: unknown[]) => mockDecryptCredentials(...args),
  encryptCredentials: (...args: unknown[]) => mockEncryptCredentials(...args),
}));

// Mock IOLClient — must use `class` syntax for `new IOLClient(...)` to work
const mockPlaceBuyOrder = vi.fn();
const mockPlaceSellOrder = vi.fn();
const mockCancelOrder = vi.fn();
const mockGetAllPortfolios = vi.fn();
const mockGetToken = vi.fn();

vi.mock("@/services/iol", () => ({
  IOLClient: class MockIOLClient {
    constructor() {}
    placeBuyOrder = mockPlaceBuyOrder;
    placeSellOrder = mockPlaceSellOrder;
    cancelOrder = mockCancelOrder;
    getAllPortfolios = mockGetAllPortfolios;
    getToken = mockGetToken;
  },
}));

// Mock db — use functions so each call returns a fresh chain
const mockFindFirst = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSetWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      userConnections: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    insert: () => ({
      values: (...args: unknown[]) => mockInsertValues(...args),
    }),
    update: () => ({
      set: () => ({
        where: (...args: unknown[]) => mockUpdateSetWhere(...args),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  userConnections: {
    userId: "userId",
    provider: "provider",
    id: "id",
  },
  tradeAuditLog: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_USER = { id: "user-123", email: "test@example.com" };

const MOCK_IOL_TOKEN = {
  access_token: "access-abc",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "refresh-xyz",
  issued_at: Date.now(),
};

const MOCK_CONNECTION = {
  id: "conn-1",
  userId: MOCK_USER.id,
  provider: "iol",
  credentials: "encrypted-credentials",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function validTradeBody(overrides: Record<string, unknown> = {}) {
  return {
    action: "buy",
    mercado: "bCBA",
    simbolo: "GGAL",
    cantidad: 10,
    precio: 1500.5,
    plazo: "t1",
    validez: "2026-03-01",
    tipoOrden: "precioLimite",
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/iol/trade", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "192.168.1.1",
    },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(operationNumber?: string): Request {
  const url = operationNumber
    ? `http://localhost:3000/api/iol/trade?operationNumber=${operationNumber}`
    : "http://localhost:3000/api/iol/trade";
  return new Request(url, {
    method: "DELETE",
    headers: { "x-forwarded-for": "192.168.1.1" },
  });
}

/**
 * Set up mocks for the standard authenticated + connected state
 * so individual tests only need to override what they are testing.
 */
function setupDefaults() {
  mockGetAuthUser.mockResolvedValue(MOCK_USER);
  mockCheckRateLimit.mockResolvedValue(null); // not rate limited
  mockFindFirst.mockResolvedValue(MOCK_CONNECTION);
  mockDecryptCredentials.mockReturnValue(MOCK_IOL_TOKEN);
  mockEncryptCredentials.mockReturnValue("encrypted-new-token");
  mockGetToken.mockReturnValue(MOCK_IOL_TOKEN); // same token = no refresh happened
  mockInsertValues.mockResolvedValue(undefined);
  mockPlaceBuyOrder.mockResolvedValue({
    ok: true,
    numeroOperacion: 999001,
    mensaje: "Orden de compra enviada",
  });
  mockPlaceSellOrder.mockResolvedValue({
    ok: true,
    numeroOperacion: 999002,
    mensaje: "Orden de venta enviada",
  });
  mockGetAllPortfolios.mockResolvedValue({
    argentina: {
      activos: [
        {
          cantidad: 100,
          titulo: { simbolo: "GGAL" },
        },
      ],
    },
    us: { activos: [] },
  });
  mockCancelOrder.mockResolvedValue({
    ok: true,
    mensaje: "Orden 123 cancelada",
  });
  mockUpdateSetWhere.mockResolvedValue(undefined);
}

// ── Import route handlers after mocks ────────────────────────────────────────

const { POST, DELETE: DELETE_HANDLER } = await import("./route");

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/iol/trade
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/iol/trade", () => {
  // ── 1. Auth tests ────────────────────────────────────────────────────────

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockGetAuthUser.mockResolvedValue(null);
      const res = await POST(makeRequest(validTradeBody()));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("does not proceed to rate limiting when unauthenticated", async () => {
      mockGetAuthUser.mockResolvedValue(null);
      await POST(makeRequest(validTradeBody()));

      expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });
  });

  // ── 2. Rate limit tests ──────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfter: 30 },
        {
          status: 429,
          headers: {
            "Retry-After": "30",
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
      mockCheckRateLimit.mockResolvedValue(rateLimitResponse);

      const res = await POST(makeRequest(validTradeBody()));

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toContain("Too many requests");
    });

    it("calls checkRateLimit with user ID and trade config", async () => {
      await POST(makeRequest(validTradeBody()));

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        MOCK_USER.id,
        "trade",
        { limit: 5, windowSeconds: 60 }
      );
    });

    it("does not attempt DB lookups when rate limited", async () => {
      mockCheckRateLimit.mockResolvedValue(
        NextResponse.json({ error: "Rate limited" }, { status: 429 })
      );

      await POST(makeRequest(validTradeBody()));

      expect(mockFindFirst).not.toHaveBeenCalled();
    });
  });

  // ── 3. Validation tests ──────────────────────────────────────────────────

  describe("input validation", () => {
    it("returns 400 on missing required fields (action)", async () => {
      const body = validTradeBody();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (body as any).action;

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("returns 400 on missing simbolo", async () => {
      const body = validTradeBody();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (body as any).simbolo;

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("returns 400 on missing cantidad", async () => {
      const body = validTradeBody();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (body as any).cantidad;

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(400);
    });

    it("returns 400 on invalid action (not buy/sell)", async () => {
      const res = await POST(makeRequest(validTradeBody({ action: "hold" })));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/buy.*sell|Must be/i);
    });

    it("returns 400 on non-integer cantidad", async () => {
      const res = await POST(makeRequest(validTradeBody({ cantidad: 10.5 })));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/whole number|integer/i);
    });

    it("returns 400 on negative cantidad", async () => {
      const res = await POST(makeRequest(validTradeBody({ cantidad: -5 })));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("returns 400 on zero cantidad", async () => {
      const res = await POST(makeRequest(validTradeBody({ cantidad: 0 })));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("returns 400 on Infinity precio", async () => {
      // JSON.stringify(Infinity) produces null, so Zod will see null -> fail
      const res = await POST(makeRequest(validTradeBody({ precio: Infinity })));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("returns 400 on negative precio", async () => {
      const res = await POST(makeRequest(validTradeBody({ precio: -100 })));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("returns 400 on invalid validez format (not YYYY-MM-DD)", async () => {
      const res = await POST(
        makeRequest(validTradeBody({ validez: "01/03/2026" }))
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/YYYY-MM-DD/);
    });

    it("returns 400 on validez with extra characters", async () => {
      const res = await POST(
        makeRequest(validTradeBody({ validez: "2026-03-01T00:00" }))
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/YYYY-MM-DD/);
    });

    it("returns 400 on cantidad > 1,000,000", async () => {
      const res = await POST(
        makeRequest(validTradeBody({ cantidad: 1_000_001 }))
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/maximum.*1,000,000|exceeds/i);
    });

    it("accepts cantidad exactly at max boundary (1,000,000)", async () => {
      // 1,000,000 is the max allowed value — it should pass validation
      const res = await POST(
        makeRequest(validTradeBody({ cantidad: 1_000_000 }))
      );

      // Should pass validation and reach success
      expect(res.status).toBe(200);
    });

    it("returns 400 on invalid plazo", async () => {
      const res = await POST(makeRequest(validTradeBody({ plazo: "t3" })));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("returns 400 on invalid tipoOrden", async () => {
      const res = await POST(
        makeRequest(validTradeBody({ tipoOrden: "market" }))
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("returns error field path on validation failure", async () => {
      const res = await POST(makeRequest(validTradeBody({ cantidad: -1 })));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.field).toBe("cantidad");
    });
  });

  // ── 4. Connection tests ──────────────────────────────────────────────────

  describe("IOL connection", () => {
    it("returns 400 when IOL not connected", async () => {
      mockFindFirst.mockResolvedValue(null);

      const res = await POST(makeRequest(validTradeBody()));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("IOL account not connected");
    });

    it("decrypts credentials from the connection record", async () => {
      await POST(makeRequest(validTradeBody()));

      expect(mockDecryptCredentials).toHaveBeenCalledWith(
        MOCK_CONNECTION.credentials
      );
    });
  });

  // ── 5. Sell validation ────────────────────────────────────────────────────

  describe("sell order validation", () => {
    it("returns 400 with 'Insufficient holdings' when selling more than owned", async () => {
      mockGetAllPortfolios.mockResolvedValue({
        argentina: {
          activos: [
            { cantidad: 5, titulo: { simbolo: "GGAL" } },
          ],
        },
        us: { activos: [] },
      });

      const res = await POST(
        makeRequest(validTradeBody({ action: "sell", cantidad: 10 }))
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Insufficient holdings");
      expect(json.error).toContain("5"); // held quantity
      expect(json.error).toContain("GGAL");
    });

    it("returns 400 when symbol not found in portfolio (0 holdings)", async () => {
      mockGetAllPortfolios.mockResolvedValue({
        argentina: { activos: [] },
        us: { activos: [] },
      });

      const res = await POST(
        makeRequest(validTradeBody({ action: "sell", cantidad: 1 }))
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Insufficient holdings");
      expect(json.error).toContain("0");
    });

    it("does NOT check holdings for buy orders", async () => {
      await POST(makeRequest(validTradeBody({ action: "buy" })));

      expect(mockGetAllPortfolios).not.toHaveBeenCalled();
    });

    it("matches symbol case-insensitively", async () => {
      mockGetAllPortfolios.mockResolvedValue({
        argentina: {
          activos: [
            { cantidad: 100, titulo: { simbolo: "ggal" } },
          ],
        },
        us: { activos: [] },
      });

      const res = await POST(
        makeRequest(
          validTradeBody({ action: "sell", simbolo: "GGAL", cantidad: 50 })
        )
      );

      // Should succeed — case-insensitive match should find 100 shares
      expect(res.status).toBe(200);
    });

    it("checks holdings across both Argentina and US portfolios", async () => {
      mockGetAllPortfolios.mockResolvedValue({
        argentina: { activos: [] },
        us: {
          activos: [
            { cantidad: 20, titulo: { simbolo: "GGAL" } },
          ],
        },
      });

      const res = await POST(
        makeRequest(validTradeBody({ action: "sell", cantidad: 15 }))
      );

      // Should succeed — symbol found in US portfolio with 20 shares
      expect(res.status).toBe(200);
    });

    it("allows selling exact amount held", async () => {
      mockGetAllPortfolios.mockResolvedValue({
        argentina: {
          activos: [
            { cantidad: 10, titulo: { simbolo: "GGAL" } },
          ],
        },
        us: { activos: [] },
      });

      const res = await POST(
        makeRequest(validTradeBody({ action: "sell", cantidad: 10 }))
      );

      expect(res.status).toBe(200);
    });
  });

  // ── 6. Successful buy order ──────────────────────────────────────────────

  describe("successful buy order", () => {
    it("returns order details on successful buy", async () => {
      const res = await POST(makeRequest(validTradeBody()));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.numeroOperacion).toBe(999001);
      expect(json.mensaje).toBe("Orden de compra enviada");
      expect(json.order).toEqual({
        action: "buy",
        simbolo: "GGAL",
        cantidad: 10,
        precio: 1500.5,
        plazo: "t1",
      });
    });

    it("uppercases the symbol in the order", async () => {
      await POST(makeRequest(validTradeBody({ simbolo: "ggal" })));

      expect(mockPlaceBuyOrder).toHaveBeenCalledWith(
        expect.objectContaining({ simbolo: "GGAL" })
      );
    });

    it("passes all order fields to the IOL client", async () => {
      await POST(
        makeRequest(
          validTradeBody({
            mercado: "bCBA",
            simbolo: "YPFD",
            cantidad: 50,
            precio: 25000,
            plazo: "t2",
            validez: "2026-04-15",
            tipoOrden: "precioMercado",
          })
        )
      );

      expect(mockPlaceBuyOrder).toHaveBeenCalledWith({
        mercado: "bCBA",
        simbolo: "YPFD",
        cantidad: 50,
        precio: 25000,
        plazo: "t2",
        validez: "2026-04-15",
        tipoOrden: "precioMercado",
      });
    });

    it("logs the trade attempt to the audit log", async () => {
      await POST(makeRequest(validTradeBody()));

      // First insert call = "attempted" log
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: MOCK_USER.id,
          action: "buy",
          mercado: "bCBA",
          simbolo: "GGAL",
          cantidad: "10",
          precio: "1500.5",
          plazo: "t1",
          tipoOrden: "precioLimite",
          status: "attempted",
          ip: "192.168.1.1",
        })
      );
    });

    it("logs the successful trade to the audit log", async () => {
      await POST(makeRequest(validTradeBody()));

      // Second insert call = "success" log
      const calls = mockInsertValues.mock.calls;
      const successLog = calls.find(
        (call: unknown[]) =>
          (call[0] as Record<string, unknown>).status === "success"
      );
      expect(successLog).toBeDefined();
      expect(successLog![0]).toEqual(
        expect.objectContaining({
          status: "success",
          numeroOperacion: "999001",
          responseMessage: "Orden de compra enviada",
        })
      );
    });
  });

  // ── 7. Successful sell order ─────────────────────────────────────────────

  describe("successful sell order", () => {
    it("calls placeSellOrder for sell actions", async () => {
      const res = await POST(
        makeRequest(validTradeBody({ action: "sell", cantidad: 10 }))
      );

      expect(res.status).toBe(200);
      expect(mockPlaceSellOrder).toHaveBeenCalled();
      expect(mockPlaceBuyOrder).not.toHaveBeenCalled();
    });
  });

  // ── 8. Failed trade from IOL ─────────────────────────────────────────────

  describe("failed trade from IOL", () => {
    it("returns 400 when IOL client returns ok: false", async () => {
      mockPlaceBuyOrder.mockResolvedValue({
        ok: false,
        error: "Saldo insuficiente",
      });

      const res = await POST(makeRequest(validTradeBody()));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("Saldo insuficiente");
    });

    it("logs failed trade to the audit log", async () => {
      mockPlaceBuyOrder.mockResolvedValue({
        ok: false,
        error: "Market closed",
      });

      await POST(makeRequest(validTradeBody()));

      const failedLog = mockInsertValues.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as Record<string, unknown>).status === "failed"
      );
      expect(failedLog).toBeDefined();
      expect(failedLog![0]).toEqual(
        expect.objectContaining({
          status: "failed",
          responseMessage: "Market closed",
        })
      );
    });
  });

  // ── 9. Token refresh ─────────────────────────────────────────────────────

  describe("token refresh", () => {
    it("updates stored credentials when token was refreshed", async () => {
      const newToken = {
        ...MOCK_IOL_TOKEN,
        access_token: "new-access-token",
      };
      mockGetToken.mockReturnValue(newToken);

      await POST(makeRequest(validTradeBody()));

      expect(mockEncryptCredentials).toHaveBeenCalledWith(newToken);
      expect(mockUpdateSetWhere).toHaveBeenCalled();
    });

    it("does NOT update credentials when token is unchanged", async () => {
      // mockGetToken already returns the same token as MOCK_IOL_TOKEN
      await POST(makeRequest(validTradeBody()));

      expect(mockUpdateSetWhere).not.toHaveBeenCalled();
    });
  });

  // ── 10. Error handling ────────────────────────────────────────────────────

  describe("error handling", () => {
    it("returns 500 when IOL client throws an unexpected error", async () => {
      mockPlaceBuyOrder.mockRejectedValue(new Error("Network timeout"));

      const res = await POST(makeRequest(validTradeBody()));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("Network timeout");
    });

    it("returns generic message for non-Error throws", async () => {
      mockPlaceBuyOrder.mockRejectedValue("something went wrong");

      const res = await POST(makeRequest(validTradeBody()));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("Trade execution failed");
    });
  });

  // ── 11. Client IP extraction ──────────────────────────────────────────────

  describe("client IP extraction", () => {
    it("extracts IP from x-forwarded-for header", async () => {
      await POST(makeRequest(validTradeBody()));

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ ip: "192.168.1.1" })
      );
    });

    it("uses x-real-ip as fallback", async () => {
      const req = new Request("http://localhost:3000/api/iol/trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "10.0.0.1",
        },
        body: JSON.stringify(validTradeBody()),
      });

      await POST(req);

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ ip: "10.0.0.1" })
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/iol/trade (cancel order)
// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/iol/trade", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await DELETE_HANDLER(makeDeleteRequest("123"));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when operationNumber is missing", async () => {
    const res = await DELETE_HANDLER(makeDeleteRequest());

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing operationNumber parameter");
  });

  it("returns 400 when operationNumber is not a number", async () => {
    const res = await DELETE_HANDLER(makeDeleteRequest("abc"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid operationNumber");
  });

  it("returns 400 when IOL not connected", async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await DELETE_HANDLER(makeDeleteRequest("123"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("IOL account not connected");
  });

  it("cancels order and returns success", async () => {
    const res = await DELETE_HANDLER(makeDeleteRequest("123"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.mensaje).toBe("Orden 123 cancelada");
    expect(mockCancelOrder).toHaveBeenCalledWith(123);
  });

  it("logs cancel attempt to the audit log", async () => {
    await DELETE_HANDLER(makeDeleteRequest("456"));

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: MOCK_USER.id,
        action: "cancel",
        simbolo: "456",
        status: "attempted",
        ip: "192.168.1.1",
      })
    );
  });

  it("returns 400 when cancel fails", async () => {
    mockCancelOrder.mockResolvedValue({
      ok: false,
      error: "Order not found",
    });

    const res = await DELETE_HANDLER(makeDeleteRequest("999"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Order not found");
  });

  it("logs failed cancel to the audit log", async () => {
    mockCancelOrder.mockResolvedValue({
      ok: false,
      error: "Order not found",
    });

    await DELETE_HANDLER(makeDeleteRequest("999"));

    const failedLog = mockInsertValues.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as Record<string, unknown>).status === "failed"
    );
    expect(failedLog).toBeDefined();
    expect(failedLog![0]).toEqual(
      expect.objectContaining({
        status: "failed",
        responseMessage: "Order not found",
      })
    );
  });

  it("returns 500 when cancel throws an unexpected error", async () => {
    mockCancelOrder.mockRejectedValue(new Error("Connection refused"));

    const res = await DELETE_HANDLER(makeDeleteRequest("123"));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Connection refused");
  });
});
