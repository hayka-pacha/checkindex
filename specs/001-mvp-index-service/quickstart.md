# Quickstart: checkindex MVP

**Date**: 2026-02-23

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- (Optional) Google CSE API key + CX for fallback checks

## Setup

```bash
git clone https://github.com/hayka-pacha/checkindex.git
cd checkindex
pnpm install
cp .env.example .env
```

Edit `.env` with your Google CSE credentials (optional — heuristic works without them):

```env
GOOGLE_CSE_API_KEY=your-api-key
GOOGLE_CSE_CX=your-cx-id
```

## Run

```bash
# Development (hot reload)
pnpm dev

# Production
pnpm build && pnpm start
```

Server starts on `http://localhost:3000` (configurable via `PORT`).

## Usage

### Single domain check

```bash
curl "http://localhost:3000/check?domain=example.com"
```

### Single domain check with SEO signals (heuristic mode)

```bash
curl "http://localhost:3000/check?domain=example.com&keywordsTop100=42&traffic=1500&backlinks=10&domainAgeYears=3.5"
```

When signals are provided, the heuristic engine runs first (free). If confidence is high/medium, no Google CSE call is made.

### Single URL check

```bash
curl "http://localhost:3000/check?url=https://example.com/page"
```

### Batch check

```bash
curl -X POST http://localhost:3000/check/batch \
  -H "Content-Type: application/json" \
  -d '{"domains": ["example.com", "github.com", "expired-domain.xyz"]}'
```

### Health check

```bash
curl http://localhost:3000/health
```

## Tests

```bash
pnpm test          # Run once
pnpm test:watch    # Watch mode
```

## Linting

```bash
pnpm lint          # Check
pnpm lint:fix      # Auto-fix
pnpm format        # Format with Prettier
pnpm type-check    # TypeScript strict check
```

## How it works

1. **Cache check**: If the domain was checked in the last 7 days, return cached result
2. **Heuristic**: If SEO signals are provided (keywords, traffic, backlinks), infer indexation
   - `keywords > 0` or `traffic > 0` → indexed (high confidence)
   - `backlinks > 0` and `domain age > 1yr` → indexed (medium confidence)
   - All zero → not indexed (low confidence) → fall through to step 3
3. **Google CSE**: Query `site:domain.tld` via Google Custom Search API for definitive answer
4. **Cache result**: Store for 7 days to avoid redundant API calls
