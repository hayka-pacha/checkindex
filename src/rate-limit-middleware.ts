/**
 * Hono middleware for rate limiting.
 * Adds X-RateLimit-* headers to every response and returns 429 when limit exceeded.
 */

import type { MiddlewareHandler } from 'hono';
import { RateLimiter } from './rate-limiter.js';
import type { Context } from 'hono';

export interface RateLimitMiddlewareOptions {
  /** Function to extract client identifier from request (default: IP from headers). */
  keyFn?: (c: Context) => string;
  /** Function to compute request cost (default: 1). */
  costFn?: (c: Context) => number;
  /** Paths to exclude from rate limiting (e.g., /health). */
  excludePaths?: string[];
}

/**
 * Create a rate limit middleware for Hono.
 */
export function rateLimitMiddleware(
  limiter: RateLimiter,
  options: RateLimitMiddlewareOptions = {},
): MiddlewareHandler {
  const keyFn = options.keyFn ?? defaultKeyFn;
  const costFn: (c: Context) => number = options.costFn ?? ((): number => 1);
  const excludePaths = new Set(options.excludePaths ?? ['/health']);

  return async (c, next) => {
    if (excludePaths.has(c.req.path)) {
      await next();
      return;
    }

    const key = keyFn(c);
    const cost = costFn(c);
    const result = limiter.consume(key, cost);

    // Set rate limit headers on all responses
    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      c.header('Retry-After', String(Math.max(retryAfter, 1)));
      return c.json({ error: 'Too many requests' }, 429);
    }

    await next();
    return;
  };
}

/** Extract client IP from common proxy headers or fall back to remote address. */
function defaultKeyFn(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return c.req.header('x-real-ip') ?? 'unknown';
}
