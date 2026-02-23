import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCSV, createBulkJob, getJob, exportJobCSV, MAX_DOMAINS } from './bulk-job.js';

// Mock checkIndex to avoid hitting real APIs
vi.mock('./checkers/index.js', () => ({
  checkIndex: vi.fn().mockResolvedValue({
    indexed: true,
    confidence: 'high',
    method: 'heuristic',
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseCSV', () => {
  it('parses simple CSV', () => {
    const rows = parseCSV('a.com\nb.com\nc.com');
    expect(rows).toEqual([['a.com'], ['b.com'], ['c.com']]);
  });

  it('parses CSV with multiple columns', () => {
    const rows = parseCSV('a.com,notes,category\nb.com,test,seo');
    expect(rows).toEqual([
      ['a.com', 'notes', 'category'],
      ['b.com', 'test', 'seo'],
    ]);
  });

  it('handles quoted fields with commas', () => {
    const rows = parseCSV('a.com,"has, comma",ok');
    expect(rows).toEqual([['a.com', 'has, comma', 'ok']]);
  });

  it('skips empty lines', () => {
    const rows = parseCSV('a.com\n\n\nb.com\n');
    expect(rows).toEqual([['a.com'], ['b.com']]);
  });

  it('handles semicolon and tab separators', () => {
    expect(parseCSV('a.com;b')).toEqual([['a.com', 'b']]);
    expect(parseCSV('a.com\tb')).toEqual([['a.com', 'b']]);
  });
});

describe('createBulkJob', () => {
  it('creates a job from simple domain list', () => {
    const job = createBulkJob('example.com\ntest.org');
    expect(typeof job).not.toBe('string');
    if (typeof job === 'string') return;
    expect(job.id).toBeDefined();
    expect(job.total).toBe(2);
    expect(job.status).toBe('processing');
  });

  it('detects and skips header row', () => {
    const job = createBulkJob('domain,notes\nexample.com,test\nfoo.org,bar');
    expect(typeof job).not.toBe('string');
    if (typeof job === 'string') return;
    expect(job.total).toBe(2);
    expect(job.headers).toEqual(['domain', 'notes']);
  });

  it('deduplicates domains', () => {
    const job = createBulkJob('example.com\nwww.example.com\nEXAMPLE.COM');
    expect(typeof job).not.toBe('string');
    if (typeof job === 'string') return;
    expect(job.total).toBe(1);
  });

  it('preserves extra columns', () => {
    const job = createBulkJob('domain,category\nexample.com,seo');
    expect(typeof job).not.toBe('string');
    if (typeof job === 'string') return;
    expect(job.extras.get('example.com')).toEqual(['seo']);
  });

  it('returns error for empty CSV', () => {
    const result = createBulkJob('');
    expect(result).toBe('CSV is empty');
  });

  it('returns error when exceeding max domains', () => {
    const domains = Array.from({ length: MAX_DOMAINS + 1 }, (_, i) => `d${String(i)}.com`).join(
      '\n',
    );
    const result = createBulkJob(domains);
    expect(typeof result).toBe('string');
    expect(result).toContain('Too many domains');
  });

  it('job is retrievable by ID', () => {
    const job = createBulkJob('retrieve-test.com');
    expect(typeof job).not.toBe('string');
    if (typeof job === 'string') return;
    const retrieved = getJob(job.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(job.id);
  });
});

describe('exportJobCSV', () => {
  it('exports results as CSV', () => {
    const job = createBulkJob('export-test.com');
    expect(typeof job).not.toBe('string');
    if (typeof job === 'string') return;

    // Simulate completed job with results
    job.results = [
      { domain: 'export-test.com', indexed: true, confidence: 'high', method: 'heuristic' },
    ];
    job.status = 'completed';

    const csv = exportJobCSV(job);
    expect(csv).toContain('domain,indexed,confidence,method');
    expect(csv).toContain('export-test.com,true,high,heuristic');
  });
});
