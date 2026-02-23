# Feature Specification: Rate Limiting & API Quotas

**Feature Branch**: `002-rate-limiting`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "Rate limiting and API quotas"

## User Scenarios & Testing

### User Story 1 - Per-IP Rate Limiting (Priority: P1)

As a service operator, I want each client IP to be limited in request volume so that no single client can exhaust server resources or abuse the Google CSE quota.

**Why this priority**: Core protection mechanism — without rate limiting, a single client can drain the paid CSE quota in minutes and degrade service for everyone.

**Independent Test**: Send 100+ requests from one IP within 1 minute to `/check`. After exceeding the limit, subsequent requests receive a 429 response with retry timing. Other IPs remain unaffected.

**Acceptance Scenarios**:

1. **Given** a client has not exceeded their rate limit, **When** they send a `/check` request, **Then** the request is processed normally with rate limit headers in the response
2. **Given** a client has reached the per-minute limit, **When** they send another request, **Then** they receive a 429 Too Many Requests response with `Retry-After` header
3. **Given** a client was rate-limited, **When** the rate window resets, **Then** their next request is processed normally

---

### User Story 2 - Rate Limit Headers (Priority: P1)

As an API consumer, I want every response to include rate limit headers so I can proactively manage my request pacing and avoid hitting limits.

**Why this priority**: Essential for API consumers to build reliable integrations — without headers, clients cannot know their remaining quota.

**Independent Test**: Send a single `/check` request and verify response headers include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.

**Acceptance Scenarios**:

1. **Given** any successful API response, **When** the client inspects headers, **Then** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` are present with correct values
2. **Given** a 429 response, **When** the client inspects headers, **Then** `Retry-After` header indicates seconds until the window resets

---

### User Story 3 - Configurable Limits (Priority: P2)

As a service operator, I want to configure rate limits via environment variables so I can adjust thresholds without code changes based on load and CSE quota.

**Why this priority**: Different deployments may have different CSE quotas and usage patterns. Hardcoded limits don't fit all scenarios.

**Independent Test**: Set `RATE_LIMIT_PER_MINUTE=5` env var, restart server, verify the 6th request within a minute returns 429.

**Acceptance Scenarios**:

1. **Given** `RATE_LIMIT_PER_MINUTE` is set to 10, **When** the server starts, **Then** the 11th request in a window returns 429
2. **Given** no rate limit env vars are set, **When** the server starts, **Then** sensible defaults apply (60 requests/minute)

---

### User Story 4 - Batch Endpoint Weighted Limiting (Priority: P2)

As a service operator, I want batch requests to consume rate limit tokens proportional to the number of domains so that batch users cannot bypass per-request limits.

**Why this priority**: Without weighted limiting, a client could check 50 domains via batch while consuming only 1 rate limit token, effectively bypassing the limit.

**Independent Test**: With a limit of 60/min, send a batch of 50 domains. Verify that 50 tokens are consumed from the rate limit budget, leaving only 10 for subsequent requests.

**Acceptance Scenarios**:

1. **Given** a batch request with 10 domains, **When** rate limit tokens are deducted, **Then** 10 tokens are consumed (not 1)
2. **Given** a client has 5 tokens remaining, **When** they submit a batch of 10 domains, **Then** the request is rejected with 429

---

### Edge Cases

- What happens when the rate limit store has many unique IPs? Oldest entries are evicted to prevent unbounded memory growth.
- How does rate limiting interact with cached responses? Cached responses still count against the rate limit to prevent cache probing attacks.
- What happens when a batch request exceeds remaining tokens? The entire batch is rejected before processing.
- What about requests behind a reverse proxy (shared IP)? The system reads `X-Forwarded-For` header when configured.

## Requirements

### Functional Requirements

- **FR-001**: System MUST track request counts per client IP using a fixed time window
- **FR-002**: System MUST return HTTP 429 Too Many Requests when a client exceeds their rate limit
- **FR-003**: System MUST include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers on every API response
- **FR-004**: System MUST include `Retry-After` header on 429 responses indicating seconds until the window resets
- **FR-005**: System MUST support configurable rate limits via `RATE_LIMIT_PER_MINUTE` environment variable
- **FR-006**: System MUST apply a default rate limit of 60 requests per minute when no configuration is provided
- **FR-007**: System MUST count batch requests proportionally — each domain in a batch consumes one rate limit token
- **FR-008**: System MUST reject batch requests upfront if the client has insufficient remaining tokens
- **FR-009**: System MUST exempt the `/health` endpoint from rate limiting
- **FR-010**: System MUST evict stale rate limit entries to prevent unbounded memory growth

### Key Entities

- **RateLimitEntry**: Tracks request count and window start time for a client identifier (IP address)
- **RateLimitConfig**: Holds configured limits (requests per window, window duration)

## Success Criteria

### Measurable Outcomes

- **SC-001**: No single client can make more than the configured number of requests per minute
- **SC-002**: Rate-limited clients receive clear feedback (429 + headers) enabling automatic retry logic
- **SC-003**: Batch requests consume proportional quota, preventing limit bypass via batching
- **SC-004**: Rate limiting adds less than 1ms overhead per request
- **SC-005**: Service operators can adjust limits without code changes via environment configuration
