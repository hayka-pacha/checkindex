import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { PersistentCache } from './persistent-cache.js';

const TEST_DB = '/tmp/checkindex-test-cache.sqlite';

describe('PersistentCache', () => {
  let cache: PersistentCache;

  beforeEach(() => {
    // Clean up any existing test DB
    for (const f of [TEST_DB, `${TEST_DB}-wal`, `${TEST_DB}-shm`]) {
      if (existsSync(f)) unlinkSync(f);
    }
    cache = new PersistentCache(TEST_DB, 3600);
  });

  afterEach(() => {
    cache.close();
    for (const f of [TEST_DB, `${TEST_DB}-wal`, `${TEST_DB}-shm`]) {
      if (existsSync(f)) unlinkSync(f);
    }
  });

  it('returns null for unknown domain', () => {
    expect(cache.get('unknown.com')).toBeNull();
  });

  it('stores and retrieves a result', () => {
    const result = { indexed: true, confidence: 'high' as const, method: 'heuristic' as const };
    cache.set('example.com', result);
    const retrieved = cache.get('example.com');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.indexed).toBe(true);
    expect(retrieved?.confidence).toBe('high');
    expect(retrieved?.cachedAt).toBeDefined();
  });

  it('survives close and reopen (persistence)', () => {
    const result = { indexed: false, confidence: 'low' as const, method: 'google-cse' as const };
    cache.set('persist.com', result);
    cache.close();

    // Reopen with a new instance
    const cache2 = new PersistentCache(TEST_DB, 3600);
    const retrieved = cache2.get('persist.com');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.indexed).toBe(false);
    cache2.close();
  });

  it('respects TTL — expired entries return null', () => {
    vi.useFakeTimers();
    const result = { indexed: true, confidence: 'high' as const, method: 'heuristic' as const };
    cache.set('ttl-test.com', result);
    expect(cache.get('ttl-test.com')).not.toBeNull();

    // Advance past TTL (3600s = 1 hour)
    vi.advanceTimersByTime(3_600_001);
    expect(cache.get('ttl-test.com')).toBeNull();
    vi.useRealTimers();
  });

  it('preserves original TTL across restarts', () => {
    vi.useFakeTimers();
    const result = { indexed: true, confidence: 'medium' as const, method: 'heuristic' as const };
    cache.set('ttl-persist.com', result);

    // Advance 30 minutes (half of 1 hour TTL)
    vi.advanceTimersByTime(1_800_000);
    cache.close();

    // Reopen — entry should still be valid (30min remaining)
    const cache2 = new PersistentCache(TEST_DB, 3600);
    expect(cache2.get('ttl-persist.com')).not.toBeNull();

    // Advance another 31 minutes — should now be expired
    vi.advanceTimersByTime(1_860_001);
    expect(cache2.get('ttl-persist.com')).toBeNull();
    cache2.close();
    vi.useRealTimers();
  });

  it('reports correct size', () => {
    expect(cache.size()).toBe(0);
    cache.set('a.com', {
      indexed: true,
      confidence: 'high' as const,
      method: 'heuristic' as const,
    });
    cache.set('b.com', {
      indexed: false,
      confidence: 'low' as const,
      method: 'google-cse' as const,
    });
    expect(cache.size()).toBe(2);
  });

  it('evicts expired entries', () => {
    vi.useFakeTimers();
    cache.set('evict.com', {
      indexed: true,
      confidence: 'high' as const,
      method: 'heuristic' as const,
    });
    expect(cache.size()).toBe(1);

    vi.advanceTimersByTime(3_600_001);
    const evicted = cache.evictExpired();
    expect(evicted).toBe(1);
    expect(cache.size()).toBe(0);
    vi.useRealTimers();
  });

  it('tracks hit/miss statistics', () => {
    cache.set('hit.com', {
      indexed: true,
      confidence: 'high' as const,
      method: 'heuristic' as const,
    });
    cache.get('hit.com'); // hit
    cache.get('miss.com'); // miss

    const stats = cache.stats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it('overwrites existing entry on set', () => {
    cache.set('update.com', {
      indexed: false,
      confidence: 'low' as const,
      method: 'heuristic' as const,
    });
    cache.set('update.com', {
      indexed: true,
      confidence: 'high' as const,
      method: 'google-cse' as const,
    });
    const result = cache.get('update.com');
    expect(result?.indexed).toBe(true);
    expect(result?.method).toBe('google-cse');
    expect(cache.size()).toBe(1);
  });
});
