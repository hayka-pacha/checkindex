# Feature Specification: Dashboard Web UI

**Feature Branch**: `004-dashboard-ui`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "Dashboard web UI frontend"

## User Scenarios & Testing

### User Story 1 - Single Domain Check via UI (Priority: P1)

As a user, I want to enter a domain in a web form and see its indexation status so I can quickly verify if a domain is indexed by Google without using curl or the API directly.

**Why this priority**: The primary use case — a simple web interface makes the tool accessible to non-technical users and speeds up manual checks.

**Independent Test**: Open the dashboard in a browser, type "example.com" in the input field, click Check. The result appears on screen showing indexed/not-indexed status, confidence level, and method used.

**Acceptance Scenarios**:

1. **Given** the dashboard is loaded, **When** a user enters "example.com" and clicks Check, **Then** the result displays indexed status, confidence level, and method
2. **Given** a check is in progress, **When** the user waits, **Then** a loading indicator is shown
3. **Given** the API returns an error, **When** the result renders, **Then** a user-friendly error message is displayed

---

### User Story 2 - Batch Check via UI (Priority: P2)

As a user, I want to paste or upload a list of domains and see all results in a table so I can analyze multiple domains at once.

**Why this priority**: Batch checking is the second most common use case. A visual table is more useful than raw JSON for comparing results.

**Independent Test**: Paste 5 domains in the batch input, submit. A table renders with one row per domain showing status, confidence, and method.

**Acceptance Scenarios**:

1. **Given** a user enters 5 domains (one per line), **When** they submit the batch, **Then** a results table shows one row per domain with status, confidence, and method
2. **Given** a batch is processing, **When** results arrive, **Then** each row updates progressively (not all at once)
3. **Given** the batch exceeds 50 domains, **When** the user submits, **Then** a validation message indicates the 50-domain limit

---

### User Story 3 - Check History (Priority: P2)

As a user, I want to see my recent checks in a history panel so I can review past results without re-running checks.

**Why this priority**: Avoids redundant checks and gives users a quick reference of previous lookups during a session.

**Independent Test**: Perform 3 checks, then view the history panel. All 3 results appear in reverse chronological order.

**Acceptance Scenarios**:

1. **Given** the user has performed checks, **When** they view the history panel, **Then** results appear in reverse chronological order
2. **Given** the user checks a domain that was previously checked, **When** the result appears, **Then** it is marked as "cached"

---

### User Story 4 - SEO Signals Input (Priority: P3)

As a user, I want to optionally provide SEO signals (keywords, traffic, backlinks, domain age) alongside my domain check so the heuristic engine can give a higher-confidence result without using CSE quota.

**Why this priority**: Power users who have SEO data can get instant high-confidence results. Optional, so it doesn't complicate the basic flow.

**Independent Test**: Enter a domain with signals (keywords=50, traffic=200), submit. The result shows "heuristic" method with "high" confidence.

**Acceptance Scenarios**:

1. **Given** a user expands the "SEO Signals" panel, **When** they fill in keywords=50 and traffic=200, **Then** the result returns with method "heuristic" and confidence "high"
2. **Given** a user does not expand the signals panel, **When** they submit, **Then** the check proceeds normally without signals

---

### Edge Cases

- What happens on slow network? Loading states and timeouts are shown after 10 seconds.
- What happens with invalid domain input? Client-side validation prevents submission with clear error messages.
- What about mobile devices? The dashboard is responsive and usable on mobile screens.
- What about browser support? The dashboard works on modern browsers (Chrome, Firefox, Safari, Edge).

## Requirements

### Functional Requirements

- **FR-001**: System MUST serve a web dashboard at the root URL (`/`)
- **FR-002**: Dashboard MUST provide a single-domain check form with domain input and submit button
- **FR-003**: Dashboard MUST display check results showing: indexed status, confidence level, method used
- **FR-004**: Dashboard MUST provide a batch check form accepting multiple domains (one per line or comma-separated)
- **FR-005**: Dashboard MUST render batch results in a sortable table with columns: domain, status, confidence, method
- **FR-006**: Dashboard MUST show loading indicators during API calls
- **FR-007**: Dashboard MUST display user-friendly error messages for API failures
- **FR-008**: Dashboard MUST maintain a session history of recent checks in reverse chronological order
- **FR-009**: Dashboard MUST provide an optional collapsible panel for SEO signal inputs
- **FR-010**: Dashboard MUST validate domain input client-side before submission
- **FR-011**: Dashboard MUST be responsive and functional on mobile and desktop screens
- **FR-012**: Dashboard MUST not require any authentication for basic usage

### Key Entities

- **CheckResult**: Visual representation of an IndexCheckResult (domain, indexed, confidence, method, timestamp)
- **CheckHistory**: Ordered list of recent check results for the current session

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can check a single domain and see results within 3 seconds of submission
- **SC-002**: Users can batch-check up to 50 domains and view results in a table
- **SC-003**: The dashboard is usable without API documentation or technical knowledge
- **SC-004**: The dashboard works on the 4 major browsers (Chrome, Firefox, Safari, Edge) and mobile devices
- **SC-005**: 90% of first-time users can complete a domain check without assistance
