import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/** Per-endpoint rate limit presets */
export const RATE_LIMITS = {
  trade: { limit: 5, windowSeconds: 60 },
  quote: { limit: 60, windowSeconds: 60 },
  securities: { limit: 30, windowSeconds: 60 },
  insights: { limit: 5, windowSeconds: 60 },
  chat: { limit: 15, windowSeconds: 60 },
  mep: { limit: 30, windowSeconds: 60 },
  default: { limit: 120, windowSeconds: 60 },
} as const;

// ── Redis + Ratelimit setup ─────────────────────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

// Cache Ratelimit instances per config (limit + windowSeconds) to avoid
// recreating them on every call. The key is "limit:windowSeconds".
const rateLimiters = new Map<string, Ratelimit>();

function getRateLimiter(config: RateLimitConfig): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) return null;

  const cacheKey = `${config.limit}:${config.windowSeconds}`;
  let limiter = rateLimiters.get(cacheKey);

  if (!limiter) {
    limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
      prefix: "invblock:ratelimit",
      ephemeralCache: new Map(),
    });
    rateLimiters.set(cacheKey, limiter);
  }

  return limiter;
}

/**
 * Check rate limit for a given user + endpoint.
 * Returns null if allowed, or a NextResponse 429 if rate limited.
 *
 * Falls back to allowing the request if Redis is not configured (local dev).
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMITS.default
): Promise<NextResponse | null> {
  const limiter = getRateLimiter(config);

  if (!limiter) {
    console.warn(
      "[RateLimit] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — rate limiting disabled"
    );
    return null;
  }

  try {
    const key = `${userId}:${endpoint}`;
    const { success, limit, remaining, reset } = await limiter.limit(key);

    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(reset / 1000)),
          },
        }
      );
    }

    return null;
  } catch (error) {
    // If Redis is unreachable, allow the request through rather than
    // blocking all traffic. Log for observability.
    console.error("[RateLimit] Redis error — allowing request through:", error);
    return null;
  }
}
