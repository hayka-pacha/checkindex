# Feature Specification: Bulk CSV Import & Export

**Feature Branch**: `006-bulk-csv-import`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "Bulk CSV import and export"

## User Scenarios & Testing

### User Story 1 - CSV Upload and Check (Priority: P1)

As a user, I want to upload a CSV file containing domains and receive indexation results for all of them so I can analyze large domain portfolios efficiently.

**Why this priority**: Core feature — CSV is the standard format for domain lists in SEO workflows. Bulk analysis of hundreds of domains is a common need.

**Independent Test**: Upload a CSV with 100 domains (one per row). The system processes all domains and returns a job ID. Polling the job returns results as they complete.

**Acceptance Scenarios**:

1. **Given** a CSV file with 100 domains (one per row, first column), **When** the user uploads it, **Then** the system accepts the file and returns a job ID
2. **Given** a CSV with a header row, **When** the system parses it, **Then** the header is detected and skipped automatically
3. **Given** a CSV with extra columns (e.g., notes, categories), **When** the system parses it, **Then** only the domain column is used and extra columns are preserved in the output

---

### User Story 2 - Job Progress Tracking (Priority: P1)

As a user, I want to check the progress of my bulk import job so I know how many domains have been processed and how many remain.

**Why this priority**: Bulk jobs can take minutes. Without progress tracking, users have no visibility into completion time.

**Independent Test**: Upload a CSV of 50 domains, immediately poll the job status. Response shows processed count, total count, and estimated time remaining.

**Acceptance Scenarios**:

1. **Given** a bulk job is in progress, **When** the user polls the job endpoint, **Then** the response includes `processed`, `total`, `status` (pending/processing/completed/failed)
2. **Given** a bulk job has completed, **When** the user polls the job endpoint, **Then** status is "completed" and results are available

---

### User Story 3 - CSV Result Export (Priority: P1)

As a user, I want to download the results as a CSV file so I can use them in spreadsheets and other SEO tools.

**Why this priority**: Users need to take results back into their workflow. CSV export closes the loop from import to analysis.

**Independent Test**: After a job completes, request the results as CSV. The downloaded file contains: domain, indexed, confidence, method — one row per domain.

**Acceptance Scenarios**:

1. **Given** a completed job, **When** the user requests CSV export, **Then** they receive a CSV with columns: domain, indexed, confidence, method
2. **Given** the original CSV had extra columns, **When** results are exported, **Then** the extra columns are preserved alongside the results

---

### User Story 4 - Large File Handling (Priority: P2)

As a user, I want to upload CSV files with up to 10,000 domains so I can analyze large portfolios in a single operation.

**Why this priority**: Power users and agencies manage thousands of domains. The system must handle scale beyond the 50-domain batch limit.

**Independent Test**: Upload a CSV with 5,000 domains. The system accepts it, processes in batches internally, and completes within a reasonable time.

**Acceptance Scenarios**:

1. **Given** a CSV with 5,000 domains, **When** uploaded, **Then** the system accepts and processes it (internally batching)
2. **Given** a CSV exceeding 10,000 domains, **When** uploaded, **Then** the system rejects it with a clear error indicating the limit
3. **Given** a CSV file larger than 5MB, **When** uploaded, **Then** the system rejects it with a file size error

---

### Edge Cases

- What happens if the CSV has duplicate domains? Duplicates are deduplicated — each domain is checked once, with the result copied to all duplicate rows.
- What happens if the CSV has empty rows? Empty rows are skipped silently.
- What happens if the CSV encoding is not UTF-8? The system attempts to detect encoding or rejects with a clear error.
- What happens if the server restarts mid-job? Completed results are preserved; remaining domains are re-queued on restart.

## Requirements

### Functional Requirements

- **FR-001**: System MUST accept CSV file uploads via a dedicated endpoint
- **FR-002**: System MUST auto-detect and skip CSV header rows
- **FR-003**: System MUST extract domains from the first column of the CSV
- **FR-004**: System MUST preserve extra CSV columns in the export output
- **FR-005**: System MUST return a job ID immediately upon upload for async tracking
- **FR-006**: System MUST provide a job status endpoint returning processed count, total, and status
- **FR-007**: System MUST provide a CSV export endpoint for completed job results
- **FR-008**: System MUST support CSV files with up to 10,000 domains
- **FR-009**: System MUST reject files exceeding 10,000 domains or 5MB with clear error messages
- **FR-010**: System MUST deduplicate domains within a single CSV file
- **FR-011**: System MUST normalize domains (same as `/check` endpoint) before processing
- **FR-012**: System MUST process domains in internal batches to avoid overwhelming external APIs

### Key Entities

- **BulkJob**: Represents an upload job with ID, status, progress, timestamps, and results
- **BulkJobResult**: Per-domain result within a bulk job (domain, indexed, confidence, method)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can upload a CSV and receive all results without manual per-domain checking
- **SC-002**: A 1,000-domain CSV completes processing within 10 minutes
- **SC-003**: Users can download results as CSV for use in external tools
- **SC-004**: Job progress is trackable in real-time with accurate completion estimates
- **SC-005**: Files with up to 10,000 domains are accepted and processed reliably
