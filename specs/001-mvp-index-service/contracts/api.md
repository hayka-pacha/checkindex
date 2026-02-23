# API Contracts: MVP Index Service

**Phase**: 1 — Design & Contracts
**Date**: 2026-02-23

## Base URL

`http://localhost:3000` (configurable via `PORT` env var)

## Endpoints

### GET /check

Check indexation status for a single domain or URL.

**Query Parameters**:

| Param  | Type   | Required | Description                                |
| ------ | ------ | -------- | ------------------------------------------ |
| domain | string | no\*     | Bare domain (e.g. `example.com`)           |
| url    | string | no\*     | Full URL (e.g. `https://example.com/page`) |

\*At least one of `domain` or `url` MUST be provided.

**Success Response** (200):

```json
{
  "indexed": true,
  "confidence": "high",
  "method": "heuristic",
  "signals": {
    "keywordsTop100": 42,
    "traffic": 1500,
    "backlinks": 10,
    "domainAgeYears": 3.5
  }
}
```

```json
{
  "indexed": false,
  "confidence": "high",
  "method": "google-cse",
  "indexedPagesCount": 0
}
```

```json
{
  "indexed": true,
  "confidence": "high",
  "method": "heuristic",
  "cachedAt": "2026-02-23T01:00:00.000Z"
}
```

**Error Response** (400):

```json
{
  "error": "Invalid request",
  "details": {
    "": ["Either url or domain must be provided"]
  }
}
```

---

### POST /check/batch

Check indexation status for multiple domains in a single request.

**Request Body** (JSON):

```json
{
  "domains": ["example.com", "foo.org", "bar.net"]
}
```

| Field   | Type     | Required | Constraints                        |
| ------- | -------- | -------- | ---------------------------------- |
| domains | string[] | yes      | Max 50 elements, non-empty strings |

**Success Response** (200):

```json
{
  "results": {
    "example.com": {
      "indexed": true,
      "confidence": "high",
      "method": "heuristic",
      "signals": { "keywordsTop100": 42, "traffic": 1500, "backlinks": 10 }
    },
    "foo.org": {
      "indexed": false,
      "confidence": "high",
      "method": "google-cse",
      "indexedPagesCount": 0
    }
  }
}
```

**Error Responses**:

| Status | Body                                                    | Condition              |
| ------ | ------------------------------------------------------- | ---------------------- |
| 400    | `{ "error": "Invalid JSON body" }`                      | Malformed JSON         |
| 400    | `{ "error": "Body must be { \"domains\": string[] }" }` | Missing domains field  |
| 400    | `{ "error": "No valid domains provided" }`              | Empty or invalid array |

---

### GET /health

Health check and basic metrics.

**Success Response** (200):

```json
{
  "status": "ok",
  "cacheSize": 42
}
```

---

## Common Headers

**All responses**:

- `Content-Type: application/json`
- CORS headers (via Hono `cors()` middleware)

**All requests**:

- `Content-Type: application/json` (required for POST endpoints)

## Error Format

All errors follow the same structure:

```json
{
  "error": "Human-readable error message",
  "details": {}
}
```

The `details` field is optional and only present for validation errors (Zod `.flatten()`).
