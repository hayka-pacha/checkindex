# Feature Specification: Persistent Cache

**Feature Branch**: `003-persistent-cache`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "Persistent cache with Redis or SQLite"

## User Scenarios & Testing

### User Story 1 - Cache Survives Restarts (Priority: P1)

As a service operator, I want cached indexation results to survive server restarts so that the CSE quota is not wasted re-checking domains that were already verified.

**Why this priority**: The current in-memory cache is lost on every restart, causing unnecessary CSE API calls and wasted quota. This is the primary pain point.

**Independent Test**: Check a domain, restart the server, re-check the same domain. The second check returns the cached result without a CSE API call.

**Acceptance Scenarios**:

1. **Given** a domain result is cached, **When** the server restarts, **Then** the cached result is available immediately after restart
2. **Given** a cached entry has expired (past TTL), **When** the server restarts, **Then** the expired entry is not loaded
3. **Given** the cache storage is empty (first run), **When** the server starts, **Then** it initializes without error and operates normally

---

### User Story 2 - TTL Preservation (Priority: P1)

As a service operator, I want cache entries to retain their original TTL across restarts so that stale data is not served indefinitely.

**Why this priority**: Without TTL preservation, restarting the server would reset TTLs, serving potentially stale indexation data.

**Independent Test**: Cache a result with 7-day TTL, wait 3 days, restart server. The entry should have ~4 days remaining, not a fresh 7 days.

**Acceptance Scenarios**:

1. **Given** an entry was cached 3 days ago with 7-day TTL, **When** the server restarts, **Then** the entry has approximately 4 days TTL remaining
2. **Given** an entry's TTL has elapsed during downtime, **When** the server restarts, **Then** the entry is not loaded

---

### User Story 3 - Transparent Migration (Priority: P2)

As a service operator, I want the migration from in-memory to persistent cache to be seamless so I don't need to change any application code or API contracts.

**Why this priority**: The cache is an internal optimization. API consumers should not notice any change in behavior, responses, or performance.

**Independent Test**: Run the existing test suite without modification. All tests pass with the persistent cache backend.

**Acceptance Scenarios**:

1. **Given** the persistent cache is configured, **When** the existing test suite runs, **Then** all tests pass without modification
2. **Given** the persistent cache backend is unavailable, **When** the server starts, **Then** it falls back to in-memory cache with a warning log

---

### User Story 4 - Cache Inspection (Priority: P3)

As a service operator, I want to see cache statistics (hit rate, entry count, storage size) via the health endpoint so I can monitor cache effectiveness.

**Why this priority**: Operational visibility — helps identify if the cache is working effectively or if TTL/size needs tuning.

**Independent Test**: Query `/health` and verify the response includes `cacheSize`, `cacheHits`, `cacheMisses` fields.

**Acceptance Scenarios**:

1. **Given** the server has processed requests, **When** `/health` is queried, **Then** response includes `cacheSize`, `cacheHits`, and `cacheMisses`

---

### Edge Cases

- What happens if the storage file is corrupted? The system logs an error and starts with an empty cache.
- What happens during concurrent writes? The storage layer handles write serialization.
- What happens if disk space is full? Write failures are logged and the system continues with in-memory cache.
- What happens on first run with no existing cache file? The system initializes a new empty store.

## Requirements

### Functional Requirements

- **FR-001**: System MUST persist cache entries to durable storage that survives process restarts
- **FR-002**: System MUST preserve original TTL timestamps — entries expire based on creation time, not restart time
- **FR-003**: System MUST not load expired entries on startup
- **FR-004**: System MUST maintain the same API interface (get/set/evict) as the current in-memory cache
- **FR-005**: System MUST fall back to in-memory cache if the persistent storage is unavailable
- **FR-006**: System MUST support configurable storage path via environment variable
- **FR-007**: System MUST handle concurrent read/write operations safely
- **FR-008**: System MUST expose cache statistics (size, hits, misses) via the health endpoint
- **FR-009**: System MUST evict expired entries periodically (same as current hourly eviction)

### Key Entities

- **CacheEntry**: Domain, IndexCheckResult, creation timestamp, TTL duration
- **CacheStore**: Abstraction over storage backend (in-memory or persistent)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Cached results are available after a server restart without re-querying external APIs
- **SC-002**: Cache read/write latency remains under 5ms (no perceptible degradation from persistence)
- **SC-003**: All existing tests pass without modification after migration
- **SC-004**: Cache statistics are visible in the health endpoint for operational monitoring
- **SC-005**: Storage failures are handled gracefully with automatic fallback to in-memory cache
