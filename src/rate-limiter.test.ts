import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit', () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    const result = limiter.consume('ip-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('blocks requests over the limit', () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });
    limiter.consume('ip-1');
    limiter.consume('ip-1');
    limiter.consume('ip-1');
    const result = limiter.consume('ip-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after window expires', () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });
    limiter.consume('ip-1');
    limiter.consume('ip-1');
    expect(limiter.consume('ip-1').allowed).toBe(false);

    // Advance past window
    vi.advanceTimersByTime(60_001);
    const result = limiter.consume('ip-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('tracks different IPs independently', () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });
    expect(limiter.consume('ip-1').allowed).toBe(true);
    expect(limiter.consume('ip-1').allowed).toBe(false);
    expect(limiter.consume('ip-2').allowed).toBe(true);
  });

  it('consumes multiple tokens at once (batch cost)', () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });
    const result = limiter.consume('ip-1', 7);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);

    // Only 3 remaining, requesting 5 should fail
    const result2 = limiter.consume('ip-1', 5);
    expect(result2.allowed).toBe(false);
    expect(result2.remaining).toBe(3);
  });

  it('rejects batch cost that exceeds max on fresh window', () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    const result = limiter.consume('ip-1', 10);
    expect(result.allowed).toBe(false);
  });

  it('returns correct resetAt timestamp', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    const result = limiter.consume('ip-1');
    expect(result.resetAt).toBe(new Date('2026-01-01T00:00:00Z').getTime() + 60_000);
  });

  it('evicts expired entries', () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    limiter.consume('ip-1');
    limiter.consume('ip-2');
    expect(limiter.size()).toBe(2);

    vi.advanceTimersByTime(60_001);
    const evicted = limiter.evictExpired();
    expect(evicted).toBe(2);
    expect(limiter.size()).toBe(0);
  });

  it('uses default config (60 req/min) when no config provided', () => {
    const limiter = new RateLimiter();
    const result = limiter.consume('ip-1');
    expect(result.limit).toBe(60);
    expect(result.remaining).toBe(59);
  });
});
