/**
 * In-memory fixed-window rate limiter.
 * Tracks request counts per client key (IP) within a configurable time window.
 */

export interface RateLimitConfig {
  /** Max requests per window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly store = new Map<string, WindowEntry>();
  private readonly config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRequests: config.maxRequests ?? 60,
      windowMs: config.windowMs ?? 60_000,
    };
  }

  /**
   * Check and consume rate limit tokens for a client key.
   * @param key Client identifier (typically IP address)
   * @param cost Number of tokens to consume (default 1, use domain count for batch)
   */
  consume(key: string, cost = 1): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    // New window or expired window
    if (!entry || now >= entry.windowStart + this.config.windowMs) {
      if (cost > this.config.maxRequests) {
        return {
          allowed: false,
          limit: this.config.maxRequests,
          remaining: this.config.maxRequests,
          resetAt: now + this.config.windowMs,
        };
      }

      this.store.set(key, { count: cost, windowStart: now });
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests - cost,
        resetAt: now + this.config.windowMs,
      };
    }

    const resetAt = entry.windowStart + this.config.windowMs;
    const remaining = this.config.maxRequests - entry.count;

    if (cost > remaining) {
      return {
        allowed: false,
        limit: this.config.maxRequests,
        remaining,
        resetAt,
      };
    }

    entry.count += cost;
    return {
      allowed: true,
      limit: this.config.maxRequests,
      remaining: this.config.maxRequests - entry.count,
      resetAt,
    };
  }

  /**
   * Evict expired entries to prevent unbounded memory growth.
   * Returns the number of evicted entries.
   */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.store) {
      if (now >= entry.windowStart + this.config.windowMs) {
        this.store.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  /** Returns current number of tracked client keys. */
  size(): number {
    return this.store.size;
  }
}
