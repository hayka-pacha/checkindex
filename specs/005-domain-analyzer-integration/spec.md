# Feature Specification: Domain Analyzer Integration

**Feature Branch**: `005-domain-analyzer-integration`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "Integration with domain-analyzer for automatic signal enrichment"

## User Scenarios & Testing

### User Story 1 - Automatic Signal Enrichment (Priority: P1)

As a user, I want the system to automatically fetch SEO signals (keywords, traffic, backlinks, domain age) from domain-analyzer when I check a domain, so I get high-confidence heuristic results without manually providing signals.

**Why this priority**: This is the core value — users no longer need to manually provide SEO signals. The system self-enriches, making the heuristic engine fully automatic.

**Independent Test**: Check a domain without providing signals. The system fetches signals from domain-analyzer, runs the heuristic with enriched data, and returns a high-confidence result with the signals included in the response.

**Acceptance Scenarios**:

1. **Given** domain-analyzer is available, **When** a user checks "example.com" without signals, **Then** the system fetches signals automatically and returns a heuristic result with enriched signals
2. **Given** a user provides signals manually, **When** they check a domain, **Then** the manual signals take precedence over auto-fetched signals
3. **Given** domain-analyzer returns partial data (some signals missing), **When** the system enriches, **Then** available signals are used and missing ones default to 0

---

### User Story 2 - Graceful Degradation on Analyzer Failure (Priority: P1)

As a service operator, I want the system to continue working normally when domain-analyzer is unavailable so that indexation checks are never blocked by an optional enrichment service.

**Why this priority**: Domain-analyzer is an external dependency. Its unavailability must not break the core check flow.

**Independent Test**: Stop domain-analyzer, then check a domain. The system skips enrichment, proceeds with CSE fallback, and logs a warning.

**Acceptance Scenarios**:

1. **Given** domain-analyzer is down, **When** a user checks a domain without signals, **Then** the system proceeds to CSE fallback (no enrichment) and logs a warning
2. **Given** domain-analyzer times out after the configured duration, **When** enrichment is attempted, **Then** the system aborts enrichment and proceeds normally
3. **Given** domain-analyzer returns invalid data, **When** the system parses the response, **Then** it discards the invalid data and proceeds without enrichment

---

### User Story 3 - Batch Enrichment (Priority: P2)

As a user, I want batch domain checks to also benefit from automatic signal enrichment so that all domains in a batch get high-confidence results.

**Why this priority**: Batch users should get the same enrichment benefit as single-check users for consistency and better results.

**Independent Test**: Submit a batch of 5 domains. All 5 are enriched with signals from domain-analyzer before heuristic evaluation.

**Acceptance Scenarios**:

1. **Given** a batch of 5 domains, **When** domain-analyzer is available, **Then** all 5 domains are enriched with signals
2. **Given** a batch where 2 out of 5 domains fail enrichment, **When** results return, **Then** the 2 failed domains proceed via CSE fallback, the other 3 use enriched heuristic

---

### User Story 4 - Enrichment Configuration (Priority: P3)

As a service operator, I want to configure the domain-analyzer connection (URL, timeout, enable/disable) via environment variables so I can control the enrichment behavior per deployment.

**Why this priority**: Not all deployments have access to domain-analyzer. The feature must be opt-in and configurable.

**Independent Test**: Set `DOMAIN_ANALYZER_URL=""` (disabled), check a domain. Verify no enrichment attempt is made.

**Acceptance Scenarios**:

1. **Given** `DOMAIN_ANALYZER_URL` is not set, **When** the server starts, **Then** enrichment is disabled and the system operates as before
2. **Given** `DOMAIN_ANALYZER_TIMEOUT_MS=500` is set, **When** enrichment takes longer than 500ms, **Then** the request is aborted

---

### Edge Cases

- What happens if domain-analyzer returns signals for a different domain? The response is discarded and a warning is logged.
- What happens if enrichment is slower than CSE? A timeout prevents enrichment from becoming a bottleneck.
- What about rate limiting on domain-analyzer's side? The system respects 429 responses and skips enrichment for subsequent domains in the same batch.

## Requirements

### Functional Requirements

- **FR-001**: System MUST fetch SEO signals from domain-analyzer when no manual signals are provided and enrichment is enabled
- **FR-002**: System MUST give manual signals precedence over auto-fetched signals
- **FR-003**: System MUST continue operating normally when domain-analyzer is unavailable
- **FR-004**: System MUST enforce a configurable timeout on domain-analyzer requests
- **FR-005**: System MUST support enabling/disabling enrichment via `DOMAIN_ANALYZER_URL` environment variable
- **FR-006**: System MUST enrich domains in batch requests when enrichment is enabled
- **FR-007**: System MUST log warnings when enrichment fails (without blocking the check flow)
- **FR-008**: System MUST validate enrichment responses and discard invalid data
- **FR-009**: System MUST not call domain-analyzer for domains that already have cached results

### Key Entities

- **EnrichmentResult**: Signals fetched from domain-analyzer (keywordsTop100, traffic, backlinks, domainAgeYears)
- **EnrichmentConfig**: URL, timeout, enabled flag

## Success Criteria

### Measurable Outcomes

- **SC-001**: Domains checked without manual signals receive automatic enrichment when domain-analyzer is available
- **SC-002**: Enrichment failures never cause check failures — the system always returns a result
- **SC-003**: Enrichment adds no more than 2 seconds to the check latency (configurable timeout)
- **SC-004**: Operators can enable/disable enrichment without code changes
- **SC-005**: Manual signals always override auto-fetched signals
