import { describe, it, expect, vi, beforeEach } from "vitest";

// Track calls to the mock limiter
let limitCallCount: Record<string, number> = {};
let mockLimitFn: ReturnType<typeof vi.fn>;

// Mock @upstash/redis before importing the module under test
vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    constructor() {}
  },
}));

// Mock @upstash/ratelimit — the limit() method tracks calls per key
// and returns { success: false } once the configured limit is exceeded
vi.mock("@upstash/ratelimit", () => {
  return {
    Ratelimit: class MockRatelimit {
      private maxRequests: number;

      constructor(opts: { limiter: { maxRequests: number } }) {
        this.maxRequests = opts.limiter.maxRequests;
      }

      async limit(key: string) {
        limitCallCount[key] = (limitCallCount[key] || 0) + 1;
        const count = limitCallCount[key];
        const success = count <= this.maxRequests;
        return {
          success,
          limit: this.maxRequests,
          remaining: Math.max(0, this.maxRequests - count),
          reset: Date.now() + 60_000,
          pending: Promise.resolve(),
        };
      }

      static slidingWindow(maxRequests: number, _window: string) {
        return { maxRequests };
      }
    },
  };
});

// Set env vars before importing the module under test
vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token");

// Import after mocks are set up
const { checkRateLimit, RATE_LIMITS } = await import("./rate-limit");

let testCounter = 0;
function uniqueUser() {
  return `user-${++testCounter}-${Date.now()}`;
}

beforeEach(() => {
  // Reset per-key call counts between tests
  limitCallCount = {};
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    const userId = uniqueUser();
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(userId, "trade", RATE_LIMITS.trade);
      expect(result).toBeNull();
    }
  });

  it("blocks requests over the limit", async () => {
    const userId = uniqueUser();
    // Use up all 5 allowed requests
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    }
    // 6th should be blocked
    const blocked = await checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("returns 429 with Retry-After header", async () => {
    const userId = uniqueUser();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    }
    const blocked = await checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    expect(blocked).not.toBeNull();
    expect(blocked!.headers.get("Retry-After")).toBeTruthy();
    expect(blocked!.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(blocked!.headers.get("X-RateLimit-Remaining")).toBe("0");

    const body = await blocked!.json();
    expect(body.error).toContain("Too many requests");
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it("tracks different endpoints independently", async () => {
    const userId = uniqueUser();
    // Max out trade (5/min)
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(userId, "trade", RATE_LIMITS.trade);
    }
    expect(await checkRateLimit(userId, "trade", RATE_LIMITS.trade)).not.toBeNull();

    // Quote endpoint should still work (different endpoint)
    expect(await checkRateLimit(userId, "quote", RATE_LIMITS.quote)).toBeNull();
  });

  it("tracks different users independently", async () => {
    const user1 = uniqueUser();
    const user2 = uniqueUser();
    // Max out user1
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(user1, "trade", RATE_LIMITS.trade);
    }
    expect(await checkRateLimit(user1, "trade", RATE_LIMITS.trade)).not.toBeNull();

    // User2 should still be allowed
    expect(await checkRateLimit(user2, "trade", RATE_LIMITS.trade)).toBeNull();
  });

  it("uses default config when none provided", async () => {
    const userId = uniqueUser();
    // Default is 120/min — should allow many requests
    for (let i = 0; i < 120; i++) {
      expect(await checkRateLimit(userId, "default-endpoint")).toBeNull();
    }
    // 121st should block
    expect(await checkRateLimit(userId, "default-endpoint")).not.toBeNull();
  });
});

describe("checkRateLimit graceful fallback", () => {
  it("allows requests when Redis env vars are missing", async () => {
    // Dynamically import a version with no env vars
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    // Need to reset module cache to pick up new env vars
    vi.resetModules();

    // Re-mock the dependencies for the fresh import
    vi.doMock("@upstash/redis", () => ({
      Redis: class MockRedis {
        constructor() {}
      },
    }));
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class MockRatelimit {
        constructor() {}
        async limit() {
          return { success: true, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve() };
        }
        static slidingWindow() { return {}; }
      },
    }));

    const { checkRateLimit: checkNoRedis } = await import("./rate-limit");

    // Should always return null (allow through) when Redis is not configured
    const result = await checkNoRedis("any-user", "any-endpoint");
    expect(result).toBeNull();
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
