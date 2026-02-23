# Implementation Plan: MVP Index Service

**Branch**: `001-mvp-index-service` | **Date**: 2026-02-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mvp-index-service/spec.md`

## Summary

Build the checkindex MVP: an HTTP API that verifies whether a domain is indexed by Google. Uses a two-layer strategy — free heuristic inference from SEO signals (primary, ~90% of cases) with Google Custom Search API fallback for ambiguous results. Includes single-domain check, batch processing (up to 50), 7-day result caching, and health monitoring.

## Technical Context

**Language/Version**: TypeScript 5.x (ESM, strict mode)
**Primary Dependencies**: Hono 4.x (HTTP framework), Zod 3.x (validation), @hono/node-server (runtime)
**Storage**: In-memory `Map<string, CacheEntry>` with TTL eviction (no database)
**Testing**: Vitest 2.x with Hono test client (`app.request()`)
**Target Platform**: Node.js >= 20 (Linux/macOS server)
**Project Type**: Web service (REST API)
**Performance Goals**: <10ms cached responses, <30s for batch of 50 domains
**Constraints**: Zero cost ≤700 CSE queries/week, minimal dependencies, no browser automation
**Scale/Scope**: 1000+ domains/week, single-process deployment

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                  | Status | Evidence                                                                           |
| -------------------------- | ------ | ---------------------------------------------------------------------------------- |
| I. Cost-First Architecture | PASS   | Heuristic is primary, CSE triggered only on `confidence: "low"`                    |
| II. Test-First Development | PASS   | 18 tests exist (5 heuristic, 5 cache, 8 server), all mocked                        |
| III. Strict Type Safety    | PASS   | `tsconfig.json` strict, Zod schemas at boundaries, `no-explicit-any` ESLint rule   |
| IV. API-First Design       | PASS   | `GET /check`, `POST /check/batch`, `GET /health` with consistent JSON              |
| V. Defensive Caching       | PASS   | `IndexCache` with 7-day TTL, hourly eviction via `setInterval`, cache-before-fetch |

**Result**: All gates PASS. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-mvp-index-service/
├── plan.md              # This file
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: entity definitions
├── quickstart.md        # Phase 1: developer onboarding
├── contracts/           # Phase 1: HTTP API contracts
│   └── api.md           # Endpoint specifications
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2: task breakdown (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── checkers/
│   ├── heuristic.ts       # Signal-based indexation inference (US3)
│   ├── heuristic.test.ts  # 5 unit tests
│   ├── google-cse.ts      # Google CSE API client (US4)
│   └── index.ts           # Orchestrator: heuristic → CSE fallback
├── cache.ts               # In-memory TTL cache (Principle V)
├── cache.test.ts          # 5 unit tests
├── server.ts              # Hono routes: /check, /check/batch, /health
├── server.test.ts         # 8 integration tests
├── types.ts               # Zod schemas + TypeScript types
└── index.ts               # Entry point: starts @hono/node-server
```

**Structure Decision**: Single project layout. All source under `src/`, tests colocated with source files (`*.test.ts` alongside `*.ts`). No separation needed — the service is small and focused.
