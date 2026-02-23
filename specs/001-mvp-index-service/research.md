# Research: MVP Index Service

**Phase**: 0 — Outline & Research
**Date**: 2026-02-23
**Branch**: `001-mvp-index-service`

## Decision 1: HTTP Framework

**Decision**: Hono 4.x

**Rationale**: Lightweight (~14KB), edge-ready, built-in CORS/logger middleware, native `app.request()` for testing without spinning up a server. Constitution constraint: "No heavyweight frameworks (Express, NestJS)."

**Alternatives considered**:

- **Express**: Heavier, no native TypeScript, requires middleware ecosystem. Rejected per constitution.
- **Fastify**: Good performance but heavier dependency tree. Overkill for this scope.
- **Elysia**: Bun-only. Node.js >= 20 is the target platform.

## Decision 2: Validation Strategy

**Decision**: Zod 3.x at all API boundaries

**Rationale**: Runtime type validation with TypeScript type inference (`z.infer<>`). Schemas serve as both validation and documentation. Constitution requires: "All API inputs MUST be validated with Zod schemas."

**Alternatives considered**:

- **io-ts**: Functional style, steeper learning curve, smaller ecosystem.
- **Joi**: No TypeScript inference, older API design.
- **Manual validation**: Error-prone, violates Principle III (Strict Type Safety).

## Decision 3: Cache Implementation

**Decision**: In-memory `Map<string, CacheEntry>` with TTL-based eviction

**Rationale**: Indexation status changes slowly (days/weeks). 7-day TTL means a domain checked Monday won't be re-checked until next Monday. In-memory is sufficient for current scale (1000 domains/week = ~1000 entries max at any time, ~500 bytes per entry = ~500KB total). Constitution: "No ORM — in-memory cache only, no database (for now)."

**Alternatives considered**:

- **Redis**: External dependency, operational overhead. Not justified at <10k entries.
- **SQLite**: Persistent but adds a dependency and file I/O. In-memory is faster.
- **LRU cache (npm)**: Adds a dependency for something `Map` + TTL handles trivially.

**Future migration path**: If scale exceeds 100k entries or persistence is needed, migrate to Redis with the same `get(domain)/set(domain, result)` interface.

## Decision 4: Google CSE Integration

**Decision**: Google Custom Search JSON API v1 via native `fetch()`

**Rationale**: Official API, stable, no blocking. Free tier: 100 queries/day (~700/week). Uses `site:domain.tld` query with `num=1` to minimize response size. No SDK needed — single `fetch()` call with URL params.

**Alternatives considered**:

- **Playwright/Puppeteer scraping**: Google blocks automated browsers after ~50-100 requests. Requires proxy rotation. Constitution: "No Playwright/Puppeteer."
- **SearXNG self-hosted**: Adds infrastructure ($5/mois VPS), maintenance burden.
- **Google Indexing API**: Only for submitting URLs, not verifying indexation.
- **Google Search Console API**: Requires domain ownership — impossible for expired domains.

**Rate limit strategy**: CSE is fallback-only (~10% of requests). At 1000 domains/week, ~100 CSE calls/week = well within free tier (700/week). Monitor via health endpoint metrics.

## Decision 5: Signal Input Strategy

**Decision**: Caller-provided signals via request parameters (FR-011)

**Rationale**: The service does NOT fetch SEO signals itself. Callers (e.g. domain-analyzer-v2) already have this data from SE Ranking and provide it alongside the check request. This keeps checkindex stateless and dependency-free.

**Alternatives considered**:

- **Built-in SE Ranking integration**: Would couple checkindex to a paid API. Violates cost-first and single-responsibility.
- **Built-in scraping for SEO data**: Fragile, rate-limited, adds complexity.

**Implication**: When no signals are provided, the orchestrator skips heuristic and falls through directly to Google CSE. This is the expected behavior for standalone usage.

## Decision 6: Error Handling Strategy

**Decision**: Graceful degradation — CSE errors return heuristic result with original confidence

**Rationale**: The service must never crash or return 500 on external API failures. If CSE fails (rate limit, network error, invalid credentials), fall back to the heuristic result even if confidence is low. The caller gets a result with honest confidence rather than an error.

**Alternatives considered**:

- **Retry with backoff**: Adds latency, may hit rate limits harder. Not worth it for a fallback.
- **Circuit breaker**: Overkill at current scale. Can add later if CSE failures become frequent.
- **Return 503**: Loses the heuristic result. User gets nothing instead of something.
