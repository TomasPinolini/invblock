import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store — resets on server restart, fine for single-instance Next.js
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

interface RateLimitConfig {
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
  default: { limit: 120, windowSeconds: 60 },
} as const;

/**
 * Check rate limit for a given user + endpoint.
 * Returns null if allowed, or a NextResponse 429 if rate limited.
 */
export function checkRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMITS.default
): NextResponse | null {
  cleanup();

  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return null;
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}
