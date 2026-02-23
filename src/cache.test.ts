import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IndexCache } from './cache.js';
import type { IndexCheckResult } from './types.js';

const makeResult = (indexed: boolean): IndexCheckResult => ({
  indexed,
  confidence: 'high',
  method: 'heuristic',
});

describe('IndexCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for unknown domain', () => {
    const cache = new IndexCache();
    expect(cache.get('unknown.com')).toBeNull();
  });

  it('returns cached result before TTL expires', () => {
    const cache = new IndexCache(3600);
    const result = makeResult(true);
    cache.set('example.com', result);

    vi.advanceTimersByTime(3_599_999);
    const cached = cache.get('example.com');

    expect(cached).not.toBeNull();
    expect(cached?.indexed).toBe(true);
    expect(cached?.cachedAt).toBeDefined();
  });

  it('returns null after TTL expires', () => {
    const cache = new IndexCache(3600);
    cache.set('example.com', makeResult(true));

    vi.advanceTimersByTime(3_600_001);

    expect(cache.get('example.com')).toBeNull();
  });

  it('evictExpired removes stale entries and reports count', () => {
    const cache = new IndexCache(3600);
    cache.set('a.com', makeResult(true));
    cache.set('b.com', makeResult(false));

    vi.advanceTimersByTime(3_600_001);
    cache.set('c.com', makeResult(true));

    const evicted = cache.evictExpired();

    expect(evicted).toBe(2);
    expect(cache.size()).toBe(1);
  });

  it('size reflects current entries', () => {
    const cache = new IndexCache();
    expect(cache.size()).toBe(0);
    cache.set('a.com', makeResult(true));
    cache.set('b.com', makeResult(false));
    expect(cache.size()).toBe(2);
  });
});
