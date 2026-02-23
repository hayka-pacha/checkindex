# checkindex Development Guidelines

Auto-generated from feature plans. Last updated: 2026-02-23

## Active Technologies

- TypeScript 5.x (ESM, strict mode)
- Hono 4.x (HTTP framework)
- Zod 3.x (validation)
- @hono/node-server (runtime)
- Vitest 2.x (testing)
- ESLint 9 flat config + Prettier
- pnpm 9.x

## Project Structure

```text
src/
├── checkers/
│   ├── heuristic.ts       # Signal-based indexation inference
│   ├── google-cse.ts       # Google Custom Search API client
│   └── index.ts            # Orchestrator (heuristic → CSE fallback)
├── cache.ts                # In-memory TTL cache (7-day default)
├── server.ts               # Hono routes: /check, /check/batch, /health
├── types.ts                # Zod schemas + TypeScript types
└── index.ts                # Entry point
```

## Commands

```bash
pnpm dev          # Dev with hot reload
pnpm build        # TypeScript compile
pnpm test         # Run tests (vitest)
pnpm lint         # ESLint check
pnpm type-check   # tsc --noEmit
pnpm format:check # Prettier check
```

## Code Style

- Strict TypeScript: no `any`, explicit return types, Zod validation at boundaries
- Tests colocated: `*.test.ts` next to source files
- Conventional Commits: `feat:`, `fix:`, `chore:`, etc.

## Architecture

- **Heuristic first** (free, instant) → CSE fallback (paid, only when confidence is `low`)
- In-memory cache with 7-day TTL — no database
- Caller provides SEO signals (keywords, traffic, backlinks) — service is stateless

## Constitution

See `.specify/memory/constitution.md` for the 5 core principles:
Cost-First, Test-First, Strict Type Safety, API-First, Defensive Caching.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
