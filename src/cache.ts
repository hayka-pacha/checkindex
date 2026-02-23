import type { IndexCheckResult } from './types.js';

interface CacheEntry {
  result: IndexCheckResult;
  expiresAt: number;
}

/**
 * In-memory TTL cache for indexation check results.
 *
 * Keyed by domain. Default TTL: 7 days (indexation status changes slowly).
 * A domain indexed today will almost certainly still be indexed in 7 days.
 */
export class IndexCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlSeconds = 604_800 /* 7 days */) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get(domain: string): IndexCheckResult | null {
    const entry = this.store.get(domain);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(domain);
      return null;
    }

    return {
      ...entry.result,
      cachedAt: new Date(entry.expiresAt - this.ttlMs).toISOString(),
    };
  }

  set(domain: string, result: IndexCheckResult): void {
    this.store.set(domain, {
      result,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /** Returns cache size (for health/metrics endpoint). */
  size(): number {
    return this.store.size;
  }

  /** Evicts all expired entries. Call periodically to avoid memory leaks. */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        evicted++;
      }
    }
    return evicted;
  }
}
