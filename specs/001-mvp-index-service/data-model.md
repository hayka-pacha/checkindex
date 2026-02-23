# Data Model: MVP Index Service

**Phase**: 1 — Design & Contracts
**Date**: 2026-02-23
**Branch**: `001-mvp-index-service`

## Entities

### Domain (value object)

The target being checked. Normalized to bare hostname.

| Field  | Type   | Constraints                                                  |
| ------ | ------ | ------------------------------------------------------------ |
| domain | string | Non-empty, lowercase, no `www.` prefix, no protocol, no path |

**Normalization rules**:

- `https://www.example.com/page` → `example.com`
- `www.example.com` → `example.com`
- `EXAMPLE.COM` → `example.com`
- `example.com` → `example.com` (no-op)

### HeuristicSignals

SEO data used by the heuristic engine to infer indexation status.

| Field          | Type              | Constraints                        |
| -------------- | ----------------- | ---------------------------------- |
| keywordsTop100 | integer           | >= 0, number of ranked keywords    |
| traffic        | number            | >= 0, estimated organic traffic    |
| backlinks      | integer           | >= 0, number of referring domains  |
| domainAgeYears | number (optional) | >= 0, age in years (fractional OK) |

**Decision matrix**:

| keywordsTop100 | traffic | backlinks | domainAgeYears | → indexed | → confidence |
| -------------- | ------- | --------- | -------------- | --------- | ------------ |
| > 0            | any     | any       | any            | true      | high         |
| any            | > 0     | any       | any            | true      | high         |
| 0              | 0       | > 0       | > 1            | true      | medium       |
| 0              | 0       | any       | ≤ 1 or absent  | false     | low          |

### IndexCheckResult

The output of any check operation (heuristic or CSE).

| Field             | Type                        | Constraints                         |
| ----------------- | --------------------------- | ----------------------------------- |
| indexed           | boolean                     | Required                            |
| confidence        | "high" \| "medium" \| "low" | Required                            |
| method            | "heuristic" \| "google-cse" | Required                            |
| indexedPagesCount | integer (optional)          | >= 0, only set by google-cse method |
| signals           | HeuristicSignals (optional) | Only set when method is "heuristic" |
| cachedAt          | ISO 8601 string (optional)  | Set when result served from cache   |

### CacheEntry (internal)

In-memory storage wrapper for IndexCheckResult.

| Field     | Type             | Constraints                   |
| --------- | ---------------- | ----------------------------- |
| result    | IndexCheckResult | The cached check result       |
| expiresAt | number           | Unix timestamp (ms) of expiry |

**Key**: Normalized domain string
**TTL**: Configurable, default 604800 seconds (7 days)
**Eviction**: Lazy on `get()` + periodic sweep every 3600 seconds (1 hour)

## Relationships

```text
Domain ──[1:1]──→ CacheEntry ──[contains]──→ IndexCheckResult
                                                    ↑
HeuristicSignals ──[used by]──→ Heuristic Engine ──┘
                                                    ↑
Domain ──[queried by]──→ Google CSE API ───────────┘
```

## State Transitions

### Check Flow

```text
Request received
    │
    ├─→ Cache HIT → return cached IndexCheckResult (with cachedAt)
    │
    └─→ Cache MISS
         │
         ├─→ Signals provided?
         │    ├─→ YES → run heuristic
         │    │    ├─→ confidence != "low" → cache & return
         │    │    └─→ confidence == "low" → fall through to CSE
         │    └─→ NO → fall through to CSE
         │
         └─→ Run Google CSE
              ├─→ SUCCESS → cache & return
              └─→ ERROR → return heuristic result (if available) or error
```
