/**
 * Bulk CSV job manager.
 * Handles async processing of domain lists with progress tracking.
 */

import { randomUUID } from 'node:crypto';
import { checkIndex } from './checkers/index.js';
import { normalizeDomain } from './domain.js';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BulkJobResult {
  domain: string;
  indexed: boolean;
  confidence: string;
  method: string;
}

export interface BulkJob {
  id: string;
  status: JobStatus;
  total: number;
  processed: number;
  results: BulkJobResult[];
  /** Original extra columns per domain (keyed by normalized domain). */
  extras: Map<string, string[]>;
  /** Original header columns (if detected). */
  headers: string[];
  createdAt: string;
  completedAt?: string;
}

const jobs = new Map<string, BulkJob>();

/** Max domains per CSV upload. */
export const MAX_DOMAINS = 10_000;
/** Max file size in bytes (5MB). */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Parse CSV text into rows of columns. Handles quoted fields. */
export function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else if (ch !== undefined) {
        current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  });
}

/** Detect if first row is a header (no dots = not a domain). */
function isHeaderRow(row: string[]): boolean {
  const first = row[0] ?? '';
  return !first.includes('.') || /^(domain|url|site|host|name)/i.test(first);
}

/** Create a bulk job from CSV text. Returns the job or an error message. */
export function createBulkJob(csvText: string): BulkJob | string {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return 'CSV is empty';

  let startIdx = 0;
  let headers: string[] = [];
  const firstRow = rows[0];
  if (firstRow && isHeaderRow(firstRow)) {
    headers = firstRow;
    startIdx = 1;
  }

  const dataRows = rows.slice(startIdx);
  if (dataRows.length === 0) return 'No data rows found';
  if (dataRows.length > MAX_DOMAINS) return `Too many domains (max ${String(MAX_DOMAINS)})`;

  // Deduplicate by normalized domain
  const seen = new Set<string>();
  const uniqueDomains: string[] = [];
  const extras = new Map<string, string[]>();

  for (const row of dataRows) {
    const raw = row[0] ?? '';
    if (!raw) continue;
    const normalized = normalizeDomain(raw);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueDomains.push(normalized);
    if (row.length > 1) {
      extras.set(normalized, row.slice(1));
    }
  }

  if (uniqueDomains.length === 0) return 'No valid domains found';

  const job: BulkJob = {
    id: randomUUID(),
    status: 'pending',
    total: uniqueDomains.length,
    processed: 0,
    results: [],
    extras,
    headers,
    createdAt: new Date().toISOString(),
  };

  jobs.set(job.id, job);

  // Start processing asynchronously
  void processBulkJob(job, uniqueDomains);

  return job;
}

/** Process domains in batches of 10. */
async function processBulkJob(job: BulkJob, domains: string[]): Promise<void> {
  job.status = 'processing';
  const batchSize = 10;

  try {
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (domain) => {
          const result = await checkIndex({ domain });
          return { domain, result };
        }),
      );

      for (const { domain, result } of results) {
        job.results.push({
          domain,
          indexed: result.indexed,
          confidence: result.confidence,
          method: result.method,
        });
        job.processed++;
      }
    }

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
  } catch {
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
  }
}

/** Retrieve a job by ID. */
export function getJob(id: string): BulkJob | undefined {
  return jobs.get(id);
}

/** Export job results as CSV text. */
export function exportJobCSV(job: BulkJob): string {
  const hasExtras = job.extras.size > 0;
  const headerCols = ['domain', 'indexed', 'confidence', 'method'];
  if (hasExtras && job.headers.length > 1) {
    headerCols.push(...job.headers.slice(1));
  }

  const lines = [headerCols.join(',')];

  for (const r of job.results) {
    const row = [r.domain, String(r.indexed), r.confidence, r.method];
    const extra = job.extras.get(r.domain);
    if (extra) {
      row.push(...extra);
    }
    lines.push(row.map((v) => (v.includes(',') ? `"${v}"` : v)).join(','));
  }

  return lines.join('\n');
}
