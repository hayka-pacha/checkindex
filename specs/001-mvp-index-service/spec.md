# Feature Specification: MVP Index Service

**Feature Branch**: `001-mvp-index-service`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "MVP complet du service checkindex — API de vérification d'indexation Google avec heuristic engine + Google CSE fallback, intégration des sources de données SEO"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Single Domain Indexation Check (Priority: P1)

A user submits a single domain (e.g. `example.com`) or URL (e.g. `https://example.com/page`) to verify whether it is currently indexed by Google. The system returns a clear yes/no answer with a confidence level and the method used.

**Why this priority**: This is the core value proposition. Without single-domain check, the service has no reason to exist.

**Independent Test**: Submit a known-indexed domain and a known-not-indexed domain. Verify the response includes `indexed`, `confidence`, and `method` fields with correct values.

**Acceptance Scenarios**:

1. **Given** a domain with active keyword rankings, **When** the user submits a check request with `domain=example.com`, **Then** the system returns `indexed: true` with `confidence: "high"` and `method: "heuristic"` with relevant signals
2. **Given** a domain with zero keywords, zero traffic, and zero backlinks, **When** the user submits a check request, **Then** the system returns `indexed: false` with `confidence: "low"` or escalates to Google CSE for confirmation
3. **Given** a full URL, **When** the user submits a check request with `url=https://example.com/page`, **Then** the system extracts the domain and checks indexation
4. **Given** no domain or URL parameter, **When** the user submits a check request, **Then** the system returns a 400 error with a descriptive message
5. **Given** a domain that was already checked within 7 days, **When** the user submits the same domain again, **Then** the system returns the cached result instantly without making external calls

---

### User Story 2 - Batch Domain Check (Priority: P2)

A user submits a list of domains (up to 50) in a single request to verify indexation status for all of them. This is critical for SEO professionals analyzing expired domain portfolios.

**Why this priority**: Batch processing is the primary use case for the target audience (domain analysis workflow at scale). Without it, users would need to make 50+ individual requests.

**Independent Test**: Submit a JSON body with 5 domains (mix of indexed and not-indexed). Verify all 5 results are returned in a single response with correct indexation status.

**Acceptance Scenarios**:

1. **Given** a list of 5 valid domains, **When** the user submits a batch check with `{ "domains": ["a.com", "b.com", "c.com", "d.com", "e.com"] }`, **Then** the system returns results for all 5 domains
2. **Given** a list of 60 domains (exceeding the limit), **When** the user submits the batch, **Then** only the first 50 are processed and results returned
3. **Given** a batch with some cached and some uncached domains, **When** the user submits the batch, **Then** cached domains are served from cache and only uncached domains trigger external lookups
4. **Given** an invalid JSON body, **When** the user submits the batch, **Then** the system returns a 400 error

---

### User Story 3 - Heuristic-Based Indexation Inference (Priority: P1)

The system uses existing SEO signals (keyword rankings, organic traffic, backlink count, domain age) to infer indexation status without making any paid API call. This is the primary check method covering ~90% of cases at zero cost.

**Why this priority**: Cost-first architecture mandates the heuristic as the primary path. This is what makes the service economically viable at scale (1000+ domains/week).

**Independent Test**: Feed the heuristic engine with known signal combinations and verify the confidence/indexed output matches the expected decision matrix.

**Acceptance Scenarios**:

1. **Given** signals with `keywordsTop100 > 0`, **When** the heuristic runs, **Then** it returns `indexed: true, confidence: "high"`
2. **Given** signals with `traffic > 0`, **When** the heuristic runs, **Then** it returns `indexed: true, confidence: "high"`
3. **Given** signals with `backlinks > 0` AND `domainAge > 1 year`, **When** the heuristic runs, **Then** it returns `indexed: true, confidence: "medium"`
4. **Given** all signals at zero, **When** the heuristic runs, **Then** it returns `indexed: false, confidence: "low"` and the orchestrator escalates to Google CSE

---

### User Story 4 - Google CSE Fallback (Priority: P2)

When the heuristic engine returns low confidence, the system falls back to Google Custom Search API using a `site:domain.tld` query. This provides a definitive yes/no answer with page count.

**Why this priority**: The CSE fallback elevates confidence from "low" to "high" for ambiguous cases (~10% of checks). Without it, some results would be unreliable.

**Independent Test**: Configure valid Google CSE credentials and submit a domain with zero heuristic signals. Verify the system makes a `site:` query and returns a definitive result with `indexedPagesCount`.

**Acceptance Scenarios**:

1. **Given** valid CSE credentials and a domain indexed by Google, **When** the CSE checker runs, **Then** it returns `indexed: true, confidence: "high", method: "google-cse"` with `indexedPagesCount > 0`
2. **Given** valid CSE credentials and a domain NOT indexed, **When** the CSE checker runs, **Then** it returns `indexed: false, confidence: "high", method: "google-cse"` with `indexedPagesCount: 0`
3. **Given** missing or invalid CSE credentials, **When** the CSE checker is triggered, **Then** the system returns the heuristic result with a warning (not a crash)
4. **Given** the Google CSE API returns a rate limit or error, **When** the CSE checker runs, **Then** the system returns the heuristic result with its original low confidence instead of failing

---

### User Story 5 - Health & Monitoring (Priority: P3)

An operator can check service health and basic metrics (cache size) to monitor the service in production.

**Why this priority**: Important for operations but not for core indexation checking functionality.

**Independent Test**: Hit the health endpoint and verify the response includes status and cache metrics.

**Acceptance Scenarios**:

1. **Given** the service is running, **When** the operator hits the health endpoint, **Then** the system returns `status: "ok"` and current `cacheSize`

---

### Edge Cases

- What happens when a domain is syntactically invalid (e.g. `not a domain`, empty string)?
- What happens when the domain has a `www.` prefix or includes a protocol/path?
- What happens when Google CSE returns an unexpected response format or HTML error page?
- What happens when the cache reaches very large sizes (100k+ entries) and memory pressure increases?
- What happens when multiple concurrent requests check the same uncached domain simultaneously?
- What happens when the heuristic signals are partially provided (e.g. keywords but no traffic)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST accept a domain (`example.com`) or URL (`https://example.com/page`) and return indexation status
- **FR-002**: System MUST use heuristic signals as the primary check method at zero cost
- **FR-003**: System MUST fall back to Google CSE API only when heuristic confidence is `low`
- **FR-004**: System MUST cache results with a configurable TTL (default 7 days)
- **FR-005**: System MUST support batch requests of up to 50 domains per call
- **FR-006**: System MUST normalize domains (strip `www.`, extract hostname from URLs) before processing
- **FR-007**: System MUST validate all inputs and return descriptive error messages for invalid requests
- **FR-008**: System MUST expose a health endpoint reporting service status and cache metrics
- **FR-009**: System MUST handle Google CSE API errors gracefully (return heuristic result instead of crashing)
- **FR-010**: System MUST support CORS for cross-origin consumption
- **FR-011**: System MUST accept heuristic signals (keywords, traffic, backlinks, domain age) as part of the check request to enable callers to provide their own SEO data

### Key Entities

- **Domain**: The target being checked — normalized to bare hostname (e.g. `example.com`), serves as cache key
- **IndexCheckResult**: The output of a check — includes `indexed` (boolean), `confidence` (high/medium/low), `method` (heuristic/google-cse), optional `indexedPagesCount` and `signals`
- **HeuristicSignals**: SEO data used for inference — `keywordsTop100` (integer), `traffic` (number), `backlinks` (integer), `domainAgeYears` (number, optional)
- **CacheEntry**: A stored result with TTL — keyed by domain, includes result and expiry timestamp

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 90% of domain checks are resolved by the heuristic engine alone (no paid API call)
- **SC-002**: Cached responses are returned within 10 milliseconds
- **SC-003**: A batch of 50 domains completes within 30 seconds including any CSE fallbacks
- **SC-004**: The service correctly identifies known-indexed domains with >95% accuracy
- **SC-005**: The service runs at zero cost for up to 700 checks per week using Google CSE free tier
- **SC-006**: All API responses conform to a documented, validated JSON schema
