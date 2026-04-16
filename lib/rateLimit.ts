/**
 * In-memory rate limiter — shared utility for API routes.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 });
 *   if (!limiter.check(ip)) return NextResponse.json(..., { status: 429 });
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window per key */
  max: number;
}

interface RateLimiter {
  /**
   * Returns true if the request is within the rate limit, false if exceeded.
   * Automatically increments the counter.
   */
  check(key: string): boolean;
}

/**
 * Creates an in-memory rate limiter instance.
 * Each instance maintains its own Map, so different API routes
 * have independent counters.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max } = options;
  const map = new Map<string, RateLimitEntry>();

  return {
    check(key: string): boolean {
      const now = Date.now();
      const entry = map.get(key);

      if (!entry || now > entry.resetAt) {
        map.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      entry.count++;
      return entry.count <= max;
    },
  };
}
