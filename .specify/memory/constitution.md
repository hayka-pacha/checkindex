<!--
Sync Impact Report
  Version change: N/A → 1.0.0 (initial ratification)
  Added principles:
    - I. Cost-First Architecture
    - II. Test-First Development
    - III. Strict Type Safety
    - IV. API-First Design
    - V. Defensive Caching
  Added sections:
    - Technology Stack & Constraints
    - Development Workflow & Quality Gates
    - Governance
  Templates requiring updates:
    - .specify/templates/plan-template.md — no update needed (generic)
    - .specify/templates/spec-template.md — no update needed (generic)
    - .specify/templates/tasks-template.md — no update needed (generic)
  Follow-up TODOs: none
-->

# checkindex Constitution

## Core Principles

### I. Cost-First Architecture

Every design decision MUST minimize operational cost.
The heuristic engine (free, instant) is the primary check method.
Paid APIs (Google Custom Search) are fallback-only, triggered when heuristic confidence is `low`.

- External API calls MUST be justified by insufficient free signals
- New data sources MUST be evaluated cost-vs-accuracy before integration
- Batch operations MUST respect API quotas and rate limits
- Free tier limits (100 CSE queries/day) MUST be monitored, never silently exceeded

### II. Test-First Development

TDD is mandatory. Tests written first, verified failing, then implementation.

- Red-Green-Refactor cycle strictly enforced
- Every checker (heuristic, CSE, future sources) MUST have unit tests with mocked externals
- Server endpoints MUST have integration tests via Hono test client
- Coverage target: >85% on `src/` (excluding type-only files)
- Tests MUST NOT hit external APIs — mock all network calls

### III. Strict Type Safety

TypeScript strict mode is non-negotiable. Runtime validation at system boundaries.

- `tsconfig.json` strict options MUST remain enabled (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- All API inputs MUST be validated with Zod schemas before processing
- `any` type is forbidden — ESLint rule `@typescript-eslint/no-explicit-any: error`
- All public functions MUST have explicit return types
- Type assertions (`as`) are allowed only when Zod `.parse()` has already validated the data

### IV. API-First Design

Every capability MUST be exposed as an HTTP endpoint with consistent JSON responses.

- Endpoints follow REST conventions: `GET /check`, `POST /check/batch`, `GET /health`
- Error responses MUST include `error` field with human-readable message and optional `details`
- Success responses MUST include `indexed`, `confidence`, and `method` fields
- Batch endpoints MUST enforce a maximum size (currently 50) to prevent abuse
- CORS enabled by default for frontend consumption

### V. Defensive Caching

Cache aggressively. Indexation status changes slowly (days/weeks, not minutes).

- Default TTL: 7 days — sufficient for domain indexation verification
- Cache key: normalized bare domain (no `www.`, no protocol)
- Cache MUST be checked before any external call
- Expired entries MUST be evicted periodically (hourly) to prevent memory leaks
- Cache miss on ambiguous heuristic result triggers CSE fallback, result is then cached

## Technology Stack & Constraints

| Layer      | Choice                     | Rationale                             |
| ---------- | -------------------------- | ------------------------------------- |
| Runtime    | Node.js >= 20              | Native fetch, ESM, modern APIs        |
| Language   | TypeScript 5.x (strict)    | Type safety, IDE support              |
| Framework  | Hono                       | Lightweight, edge-ready, fast         |
| Validation | Zod                        | Runtime schemas, TypeScript inference |
| Testing    | Vitest                     | Fast, ESM-native, Hono test helpers   |
| Linting    | ESLint 9 (flat config)     | strictTypeChecked for src             |
| Formatting | Prettier                   | Consistent style, no debates          |
| Packages   | pnpm                       | Fast, disk-efficient, strict deps     |
| CI         | GitHub Actions             | Lint + type-check + test + gitleaks   |
| Secrets    | gitleaks (pre-commit + CI) | Prevent credential leaks              |

**Constraints**:

- No heavyweight frameworks (Express, NestJS) — Hono covers all needs
- No ORM — in-memory cache only, no database (for now)
- No Playwright/Puppeteer — Google blocks scraping at scale, CSE API is the reliable path
- Dependencies MUST be minimal — every new dep requires justification

## Development Workflow & Quality Gates

**Branch strategy**: `main` is protected. Feature branches via PR.

**Pre-commit hooks** (Husky + lint-staged):

1. gitleaks — blocks commits containing secrets
2. ESLint — auto-fixes staged `.ts` files
3. Prettier — auto-formats staged files

**CI pipeline** (GitHub Actions on push/PR):

1. `pnpm lint` — zero warnings allowed
2. `pnpm type-check` — zero errors
3. `pnpm format:check` — no formatting drift
4. `pnpm test` — all tests pass
5. gitleaks-action — full history scan

**Quality gates before merge**:

- All CI checks green
- No `NEEDS CLARIFICATION` markers in specs
- No `TODO` in production code (TODOs go in issues)
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)

## Governance

This constitution supersedes all ad-hoc practices.

- Amendments MUST be documented with version bump, rationale, and date
- MAJOR version: principle removed or fundamentally redefined
- MINOR version: new principle or section added
- PATCH version: clarifications, wording, non-semantic changes
- All PRs MUST verify compliance with these principles
- Complexity beyond what the constitution allows MUST be justified in a Complexity Tracking table

**Version**: 1.0.0 | **Ratified**: 2026-02-23 | **Last Amended**: 2026-02-23
