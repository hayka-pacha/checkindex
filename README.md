# checkindex

> Google indexation verification service — instantly check if any URL or domain is indexed by Google.

## What it does

`checkindex` provides a fast, cost-efficient API to verify whether a URL or domain appears in Google's index. It uses a two-layer strategy:

1. **Primary — Heuristic engine**: Uses existing SEO signals (keywords, traffic, backlinks) to infer indexation status at zero cost.
2. **Secondary — Google Custom Search API**: Runs `site:domain.tld` queries for ambiguous cases (100 free/day, $5/1000 beyond).

## Architecture

```
src/
├── checkers/
│   ├── heuristic.ts        # Signal-based indexation inference
│   ├── google-cse.ts       # Google Custom Search API client
│   └── index.ts            # Orchestrator (heuristic → CSE fallback)
├── types.ts                # Shared types & Zod schemas
├── cache.ts                # 7-day result caching
└── index.ts                # Entry point
```

## Quick start

```bash
pnpm install
cp .env.example .env
# Add GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX in .env
pnpm dev
```

## API

```
GET /check?url=https://example.com
GET /check?domain=example.com

Response:
{
  "indexed": true,
  "confidence": "high",   // "high" | "medium" | "low"
  "method": "heuristic",  // "heuristic" | "google-cse"
  "signals": { ... }
}
```

## Cost model

| Volume         | Cost                      |
| -------------- | ------------------------- |
| ≤ 700/week     | $0 (Google CSE free tier) |
| 1,000/week     | ~$1.50/week               |
| Heuristic-only | Always $0                 |

## Pre-commit hooks

- **gitleaks** — prevents committing secrets
- **eslint** — linting on staged `.ts` files
- **prettier** — formatting on staged files

## License

MIT
