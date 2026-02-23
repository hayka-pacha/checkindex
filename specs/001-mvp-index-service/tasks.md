# Tasks: MVP Index Service

**Input**: Design documents from `/specs/001-mvp-index-service/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Context**: The project already has a working skeleton (types, cache, heuristic, CSE client, server, entry point) with 18 passing tests. These tasks complete the MVP to full spec compliance.

## Phase 1: Setup

**Purpose**: No setup needed — project structure, dependencies, linting, CI already in place.

_SKIP — all setup tasks completed in prior commits._

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared utilities needed by multiple user stories before implementation can begin.

- [ ] T001 Create `normalizeDomain()` utility in `src/domain.ts` — strips `www.`, extracts hostname from URLs, lowercases. Replaces inline `extractDomain()` in `server.ts`. Must handle: `https://www.EXAMPLE.com/page` → `example.com`, `www.foo.org` → `foo.org`, `BAR.NET` → `bar.net`, invalid input → return as-is
- [ ] T002 Write tests for `normalizeDomain()` in `src/domain.test.ts` — cover: URL extraction, www stripping, lowercasing, bare domain passthrough, invalid input fallback, empty string
- [ ] T003 Update `IndexCheckRequestSchema` in `src/types.ts` to accept optional heuristic signal fields (`keywordsTop100`, `traffic`, `backlinks`, `domainAgeYears`) as query string numbers via `z.coerce.number()` — these are string-encoded numbers from query params

**Checkpoint**: Foundation ready — normalization utility tested, schema updated.

---

## Phase 3: User Story 1+3 — Single Domain Check + Heuristic Inference (Priority: P1)

**Goal**: `/check` endpoint accepts domain/URL + optional SEO signals, runs heuristic first, returns indexed status with confidence.

**Independent Test**: `GET /check?domain=example.com&keywordsTop100=42&traffic=100` returns `indexed: true, confidence: "high", method: "heuristic"` with signals in response.

### Tests for US1+US3

- [ ] T004 [P] [US1] Write test in `src/server.test.ts`: `/check` with signal query params (`keywordsTop100=50&traffic=200`) returns heuristic result with signals in response
- [ ] T005 [P] [US1] Write test in `src/server.test.ts`: `/check` with domain only (no signals) falls through to CSE (mock)
- [ ] T006 [P] [US1] Write test in `src/server.test.ts`: `/check` normalizes `www.example.com` domain param to `example.com`

### Implementation for US1+US3

- [ ] T007 [US1] Update `GET /check` handler in `src/server.ts` — parse optional signal fields from query, pass to `checkIndex({ domain, signals })`. Use `normalizeDomain()` from `src/domain.ts` instead of inline `extractDomain()`
- [ ] T008 [US1] Remove inline `extractDomain()` from `src/server.ts` — replaced by `normalizeDomain()` import
- [ ] T009 [US1] Verify existing tests still pass after refactor — run `pnpm test`

**Checkpoint**: Single domain check with heuristic signals works end-to-end. Heuristic-only flow fully testable.

---

## Phase 4: User Story 2 — Batch Domain Check (Priority: P2)

**Goal**: `POST /check/batch` normalizes domains and supports signals per domain.

**Independent Test**: Batch with `www.` prefixed domains returns results keyed by normalized domain.

### Tests for US2

- [ ] T010 [P] [US2] Write test in `src/server.test.ts`: batch endpoint normalizes `www.example.com` to `example.com` in result keys

### Implementation for US2

- [ ] T011 [US2] Update `POST /check/batch` in `src/server.ts` — apply `normalizeDomain()` to each domain before cache lookup and checkIndex call

**Checkpoint**: Batch check normalizes all domains correctly.

---

## Phase 5: User Story 4 — Google CSE Fallback with Graceful Degradation (Priority: P2)

**Goal**: CSE errors (missing credentials, rate limits, network failures) never crash the service. The orchestrator catches errors and falls back to the heuristic result.

**Independent Test**: With invalid/missing CSE credentials and zero signals, the check returns a low-confidence heuristic result instead of 500.

### Tests for US4

- [ ] T012 [P] [US4] Write tests for `checkIndexGoogleCSE` in `src/checkers/google-cse.test.ts` — mock `fetch`: success case (totalResults > 0), not-indexed case (totalResults 0), HTTP error (non-200 status), missing env vars, unexpected response format
- [ ] T013 [P] [US4] Write tests for orchestrator in `src/checkers/index.test.ts` — mock both heuristic and CSE: heuristic high confidence → no CSE call, heuristic low confidence → CSE called, CSE throws → returns heuristic low-confidence result, no signals → CSE called directly, no signals + CSE throws → returns fallback error result

### Implementation for US4

- [ ] T014 [US4] Update `checkIndex()` in `src/checkers/index.ts` — wrap `checkIndexGoogleCSE(domain)` in try/catch. On error: if heuristic ran, return heuristic result with original confidence. If no heuristic (no signals), return `{ indexed: false, confidence: "low", method: "heuristic" }` as safe default
- [ ] T015 [US4] Update `checkIndexGoogleCSE()` in `src/checkers/google-cse.ts` — throw typed errors (distinguish missing config vs API error vs network error) for better orchestrator handling

**Checkpoint**: CSE failures are fully graceful. No 500 errors from external API failures.

---

## Phase 6: User Story 5 — Health & Monitoring (Priority: P3)

**Purpose**: Already implemented and tested.

_SKIP — `GET /health` with cache size already exists with passing test._

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, documentation, and final validation.

- [ ] T016 [P] Write edge case tests in `src/server.test.ts`: invalid domain format (empty string, spaces, special chars) returns 400
- [ ] T017 [P] Write edge case test in `src/domain.test.ts`: concurrent normalization calls are safe (no shared state)
- [ ] T018 Update `specs/001-mvp-index-service/quickstart.md` with signal query param examples
- [ ] T019 Run full validation: `pnpm lint && pnpm type-check && pnpm test` — all must pass with zero errors
- [ ] T020 Verify spec compliance: manually check each FR (FR-001 through FR-011) against implemented code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **US1+US3 (Phase 3)**: Depends on Phase 2 (normalizeDomain, updated schema)
- **US2 (Phase 4)**: Depends on Phase 2 (normalizeDomain)
- **US4 (Phase 5)**: No dependency on Phase 3/4 — can run in parallel after Phase 2
- **Polish (Phase 7)**: Depends on all story phases complete

### Within Each Phase

- Tests MUST be written first and verified failing before implementation (TDD)
- Implementation tasks depend on their phase's test tasks
- Each phase ends with a checkpoint validation

### Parallel Opportunities

- T001 and T003 can run in parallel (different files)
- T004, T005, T006 can run in parallel (different test cases, same file but independent)
- T010 can run in parallel with Phase 3 implementation (different endpoint)
- T012 and T013 can run in parallel (different test files)
- Phase 3 (US1+US3) and Phase 5 (US4) can run in parallel after Phase 2
- T016 and T017 can run in parallel (different test files)

---

## Implementation Strategy

### MVP First (US1+US3 Only)

1. Complete Phase 2: Foundational (T001-T003)
2. Complete Phase 3: Single check with signals (T004-T009)
3. **STOP and VALIDATE**: Run `pnpm test`, verify heuristic flow works with signals
4. This alone delivers the core value proposition

### Full MVP (All Stories)

1. Phase 2: Foundational → T001-T003
2. Phase 3: US1+US3 → T004-T009 (parallel with Phase 5 tests)
3. Phase 4: US2 → T010-T011
4. Phase 5: US4 → T012-T015
5. Phase 7: Polish → T016-T020
6. Final: All 11 FRs satisfied, all 6 SCs verifiable

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Total: 20 tasks (3 foundational, 6 US1+US3, 2 US2, 4 US4, 5 polish)
- Existing code: 18 tests already passing — these tasks ADD to that, not replace
- TDD mandatory per constitution: write test → verify it fails → implement → verify it passes
