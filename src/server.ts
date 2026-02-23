import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { checkIndex } from './checkers/index.js';
import { IndexCache } from './cache.js';
import { IndexCheckRequestSchema } from './types.js';

const cache = new IndexCache(parseInt(process.env['CACHE_TTL_SECONDS'] ?? '604800', 10));

// Evict expired cache entries every hour
setInterval(() => cache.evictExpired(), 3_600_000).unref();

export const app = new Hono();

app.use('*', cors());
app.use('*', logger());

/**
 * Health check endpoint.
 * Returns server status and cache size.
 */
app.get('/health', (c) => {
  return c.json({ status: 'ok', cacheSize: cache.size() });
});

/**
 * Check if a domain or URL is indexed by Google.
 *
 * Query params:
 *   - domain: "example.com"
 *   - url: "https://example.com/page"
 *
 * Strategy:
 *   1. Serve from cache if available (7-day TTL)
 *   2. Run heuristic check (free, instant)
 *   3. Fall back to Google CSE if confidence is low
 */
app.get('/check', async (c) => {
  const query = c.req.query();
  const parsed = IndexCheckRequestSchema.safeParse(query);

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const { domain, url } = parsed.data;

  // Normalise to a bare domain for cache key and CSE queries
  // Zod refine guarantees domain or url is defined, so url ?? '' is safe here
  const targetDomain = domain ?? extractDomain(url ?? '');

  const cached = cache.get(targetDomain);
  if (cached) {
    return c.json(cached);
  }

  const result = await checkIndex({ domain: targetDomain });

  cache.set(targetDomain, result);

  return c.json(result);
});

/**
 * Batch check — accepts a JSON body with an array of domains.
 * Useful for bulk analysis without hammering the API from the client side.
 *
 * Body: { "domains": ["example.com", "foo.org"] }
 * Returns: { "results": { "example.com": IndexCheckResult, ... } }
 */
app.post('/check/batch', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('domains' in body) ||
    !Array.isArray((body as Record<string, unknown>)['domains'])
  ) {
    return c.json({ error: 'Body must be { "domains": string[] }' }, 400);
  }

  const domains = ((body as Record<string, unknown>)['domains'] as unknown[])
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .slice(0, 50); // max 50 per batch

  if (domains.length === 0) {
    return c.json({ error: 'No valid domains provided' }, 400);
  }

  const results = await Promise.all(
    domains.map(async (d) => {
      const cached = cache.get(d);
      if (cached) return [d, cached] as const;

      const result = await checkIndex({ domain: d });
      cache.set(d, result);
      return [d, result] as const;
    }),
  );

  return c.json({ results: Object.fromEntries(results) });
});

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
