/**
 * Cache factory — returns PersistentCache when CACHE_DB_PATH is set,
 * falls back to in-memory IndexCache otherwise.
 */

import { IndexCache } from './cache.js';
import { PersistentCache } from './persistent-cache.js';
import type { IndexCheckResult } from './types.js';

/** Common interface for both cache implementations. */
export interface CacheStore {
  get(domain: string): IndexCheckResult | null;
  set(domain: string, result: IndexCheckResult): void;
  size(): number;
  evictExpired(): number;
  stats?(): { hits: number; misses: number; size: number };
}

/** Create the appropriate cache based on environment configuration. */
export function createCache(ttlSeconds: number): CacheStore {
  const dbPath = process.env['CACHE_DB_PATH'];

  if (dbPath) {
    try {
      return new PersistentCache(dbPath, ttlSeconds);
    } catch (err) {
      console.warn('[cache] Failed to open persistent cache, falling back to in-memory:', err);
      return new IndexCache(ttlSeconds);
    }
  }

  return new IndexCache(ttlSeconds);
}
