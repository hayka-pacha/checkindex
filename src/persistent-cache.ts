/**
 * SQLite-backed persistent cache for indexation check results.
 * Drop-in replacement for IndexCache — same get/set/size/evictExpired API.
 */

import Database from 'better-sqlite3';
import type { IndexCheckResult } from './types.js';

export class PersistentCache {
  private readonly db: Database.Database;
  private readonly ttlMs: number;

  private readonly stmtGet: Database.Statement;
  private readonly stmtSet: Database.Statement;
  private readonly stmtSize: Database.Statement;
  private readonly stmtEvict: Database.Statement;

  /** Track hits/misses for health endpoint. */
  private hits = 0;
  private misses = 0;

  constructor(dbPath: string, ttlSeconds = 604_800 /* 7 days */) {
    this.ttlMs = ttlSeconds * 1000;

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        domain TEXT PRIMARY KEY,
        result TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    this.stmtGet = this.db.prepare(
      'SELECT result, created_at FROM cache WHERE domain = ? AND expires_at > ?',
    );
    this.stmtSet = this.db.prepare(
      'INSERT OR REPLACE INTO cache (domain, result, created_at, expires_at) VALUES (?, ?, ?, ?)',
    );
    this.stmtSize = this.db.prepare('SELECT COUNT(*) AS count FROM cache WHERE expires_at > ?');
    this.stmtEvict = this.db.prepare('DELETE FROM cache WHERE expires_at <= ?');
  }

  get(domain: string): IndexCheckResult | null {
    const now = Date.now();
    const row = this.stmtGet.get(domain, now) as { result: string; created_at: number } | undefined;

    if (!row) {
      this.misses++;
      return null;
    }

    this.hits++;
    const result = JSON.parse(row.result) as IndexCheckResult;
    return {
      ...result,
      cachedAt: new Date(row.created_at).toISOString(),
    };
  }

  set(domain: string, result: IndexCheckResult): void {
    const now = Date.now();
    this.stmtSet.run(domain, JSON.stringify(result), now, now + this.ttlMs);
  }

  /** Returns count of non-expired entries. */
  size(): number {
    const row = this.stmtSize.get(Date.now()) as { count: number };
    return row.count;
  }

  /** Deletes all expired entries. Returns count of evicted rows. */
  evictExpired(): number {
    const info = this.stmtEvict.run(Date.now());
    return info.changes;
  }

  /** Returns cache hit/miss statistics. */
  stats(): { hits: number; misses: number; size: number } {
    return { hits: this.hits, misses: this.misses, size: this.size() };
  }

  /** Close the database connection. */
  close(): void {
    this.db.close();
  }
}
