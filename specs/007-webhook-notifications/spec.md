# Feature Specification: Webhook Notifications

**Feature Branch**: `007-webhook-notifications`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "Webhook notifications for check results"

## User Scenarios & Testing

### User Story 1 - Register a Webhook (Priority: P1)

As an API consumer, I want to register a webhook URL so that I receive automatic notifications when domain checks complete, instead of polling for results.

**Why this priority**: Core feature — webhooks enable event-driven integrations and eliminate the need for clients to poll the API for results.

**Independent Test**: Register a webhook URL via the API. Trigger a domain check. Verify the webhook URL receives a POST with the check result payload.

**Acceptance Scenarios**:

1. **Given** a valid webhook URL, **When** the user registers it via the API, **Then** the system confirms registration and returns a webhook ID
2. **Given** an invalid URL (not HTTPS, unreachable), **When** registration is attempted, **Then** the system rejects with a validation error
3. **Given** a registered webhook, **When** a domain check completes, **Then** the webhook URL receives a POST with the result payload

---

### User Story 2 - Webhook for Bulk Jobs (Priority: P1)

As an API consumer, I want to receive a webhook notification when my bulk CSV import job completes so I don't need to poll the job status endpoint.

**Why this priority**: Bulk jobs can take minutes. Webhooks eliminate polling and enable automated downstream processing.

**Independent Test**: Register a webhook, upload a CSV. When the job completes, the webhook receives a notification with job ID, status, and result summary.

**Acceptance Scenarios**:

1. **Given** a registered webhook and a bulk job, **When** the job completes, **Then** the webhook receives a POST with job ID, status "completed", and domain count
2. **Given** a bulk job that partially fails, **When** the job finishes, **Then** the webhook payload includes success/failure counts

---

### User Story 3 - Webhook Retry on Failure (Priority: P2)

As an API consumer, I want the system to retry webhook deliveries that fail so I don't miss notifications due to temporary network issues.

**Why this priority**: Network issues are common. Without retries, webhook consumers would silently miss events.

**Independent Test**: Register a webhook pointing to a temporarily unavailable endpoint. Trigger a check. The system retries delivery up to 3 times with exponential backoff.

**Acceptance Scenarios**:

1. **Given** a webhook delivery fails (non-2xx response), **When** retry logic runs, **Then** the system retries up to 3 times with exponential backoff (1s, 5s, 30s)
2. **Given** all 3 retries fail, **When** the final retry fails, **Then** the delivery is marked as failed and logged

---

### User Story 4 - Manage Webhooks (Priority: P2)

As an API consumer, I want to list, update, and delete my registered webhooks so I can manage my integrations.

**Why this priority**: Lifecycle management is essential for any webhook system. Users need to update URLs or disable hooks.

**Independent Test**: Register a webhook, list all webhooks (returns 1), update the URL, delete it, list again (returns 0).

**Acceptance Scenarios**:

1. **Given** registered webhooks exist, **When** the user lists webhooks, **Then** all registered webhooks are returned with their IDs, URLs, and status
2. **Given** a webhook ID, **When** the user updates the URL, **Then** subsequent notifications are sent to the new URL
3. **Given** a webhook ID, **When** the user deletes it, **Then** no further notifications are sent to that URL

---

### User Story 5 - Webhook Payload Signing (Priority: P3)

As an API consumer, I want webhook payloads to be signed so I can verify that notifications are genuinely from checkindex and not spoofed.

**Why this priority**: Security measure — without signing, any party could POST fake results to the webhook URL.

**Independent Test**: Register a webhook with a secret. Trigger a check. Verify the webhook request includes an `X-Checkindex-Signature` header that matches the HMAC-SHA256 of the payload.

**Acceptance Scenarios**:

1. **Given** a webhook with a configured secret, **When** a notification is sent, **Then** the request includes `X-Checkindex-Signature` header with HMAC-SHA256 signature
2. **Given** a webhook without a secret, **When** a notification is sent, **Then** no signature header is included

---

### Edge Cases

- What happens if a webhook URL becomes permanently unreachable? After all retries fail, the webhook is marked as "failing" and notifications are paused until manually re-enabled.
- What happens if many webhooks fire simultaneously? Notifications are queued and delivered asynchronously to avoid blocking check processing.
- What about SSRF protection? Webhook URLs must be HTTPS and cannot point to private/internal IP ranges.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide an endpoint to register webhook URLs
- **FR-002**: System MUST validate webhook URLs (HTTPS required, no private IP ranges)
- **FR-003**: System MUST send POST notifications to registered webhooks when domain checks complete
- **FR-004**: System MUST send POST notifications when bulk CSV jobs complete
- **FR-005**: System MUST retry failed webhook deliveries up to 3 times with exponential backoff
- **FR-006**: System MUST provide endpoints to list, update, and delete registered webhooks
- **FR-007**: System MUST support optional HMAC-SHA256 payload signing with a user-provided secret
- **FR-008**: System MUST deliver notifications asynchronously (never block check processing)
- **FR-009**: System MUST mark webhooks as "failing" after all retries are exhausted
- **FR-010**: System MUST log all webhook delivery attempts (success and failure) for debugging

### Key Entities

- **Webhook**: URL, secret (optional), status (active/failing/disabled), creation timestamp
- **WebhookDelivery**: Webhook ID, event type, payload, HTTP status, attempt count, timestamps

## Success Criteria

### Measurable Outcomes

- **SC-001**: Registered webhooks receive notifications within 5 seconds of check completion
- **SC-002**: Transient delivery failures are recovered via retry mechanism without user intervention
- **SC-003**: Users can manage webhooks (CRUD) without direct system access
- **SC-004**: Webhook payloads can be verified via HMAC signature for security
- **SC-005**: Webhook processing never delays the check response to the requesting client
