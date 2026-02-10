import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, RATE_LIMITS } from "./rate-limit";

// We need to reset the internal store between tests.
// Since the store is module-level, we re-import each test via vi.resetModules
// OR we just use unique user IDs per test to avoid collisions.

let testCounter = 0;
function uniqueUser() {
  return `user-${++testCounter}-${Date.now()}`;
}

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const userId = uniqueUser();
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(userId, "trade", RATE_LIMITS.trade);
      expect(result).toBeNull();
    }
  });

  it("blocks requests over the limit", () => {
    const userId = uniqueUser();
    // Use up all 5 allowed requests
    for (let i = 0; i < 5; i++) {
      checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    }
    // 6th should be blocked
    const blocked = checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("returns 429 with Retry-After header", async () => {
    const userId = uniqueUser();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    }
    const blocked = checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    expect(blocked).not.toBeNull();
    expect(blocked!.headers.get("Retry-After")).toBeTruthy();
    expect(blocked!.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(blocked!.headers.get("X-RateLimit-Remaining")).toBe("0");

    const body = await blocked!.json();
    expect(body.error).toContain("Too many requests");
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it("tracks different endpoints independently", () => {
    const userId = uniqueUser();
    // Max out trade (5/min)
    for (let i = 0; i < 5; i++) {
      checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    }
    expect(checkRateLimit(userId, "trade", RATE_LIMITS.trade)).not.toBeNull();

    // Quote endpoint should still work (different endpoint)
    expect(checkRateLimit(userId, "quote", RATE_LIMITS.quote)).toBeNull();
  });

  it("tracks different users independently", () => {
    const user1 = uniqueUser();
    const user2 = uniqueUser();
    // Max out user1
    for (let i = 0; i < 5; i++) {
      checkRateLimit(user1, "trade", RATE_LIMITS.trade);
    }
    expect(checkRateLimit(user1, "trade", RATE_LIMITS.trade)).not.toBeNull();

    // User2 should still be allowed
    expect(checkRateLimit(user2, "trade", RATE_LIMITS.trade)).toBeNull();
  });

  it("resets after window expires", () => {
    const userId = uniqueUser();
    vi.useFakeTimers();

    // Max out the limit
    for (let i = 0; i < 5; i++) {
      checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    }
    expect(checkRateLimit(userId, "trade", RATE_LIMITS.trade)).not.toBeNull();

    // Advance past the 60s window
    vi.advanceTimersByTime(61_000);

    // Should be allowed again
    expect(checkRateLimit(userId, "trade", RATE_LIMITS.trade)).toBeNull();

    vi.useRealTimers();
  });

  it("uses default config when none provided", () => {
    const userId = uniqueUser();
    // Default is 120/min — should allow many requests
    for (let i = 0; i < 120; i++) {
      expect(checkRateLimit(userId, "default-endpoint")).toBeNull();
    }
    // 121st should block
    expect(checkRateLimit(userId, "default-endpoint")).not.toBeNull();
  });
});

describe("RATE_LIMITS presets", () => {
  it("has correct trade limit", () => {
    expect(RATE_LIMITS.trade).toEqual({ limit: 5, windowSeconds: 60 });
  });

  it("has correct quote limit", () => {
    expect(RATE_LIMITS.quote).toEqual({ limit: 60, windowSeconds: 60 });
  });

  it("has correct securities limit", () => {
    expect(RATE_LIMITS.securities).toEqual({ limit: 30, windowSeconds: 60 });
  });

  it("has correct insights limit", () => {
    expect(RATE_LIMITS.insights).toEqual({ limit: 5, windowSeconds: 60 });
  });

  it("has correct default limit", () => {
    expect(RATE_LIMITS.default).toEqual({ limit: 120, windowSeconds: 60 });
  });
});
