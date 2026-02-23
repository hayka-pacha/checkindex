import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enrichDomain, getEnrichmentConfig } from './enrichment.js';
import type { EnrichmentConfig } from './enrichment.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const config: EnrichmentConfig = { url: 'https://analyzer.test', timeoutMs: 2000 };

describe('getEnrichmentConfig', () => {
  it('returns null when DOMAIN_ANALYZER_URL is not set', () => {
    expect(getEnrichmentConfig()).toBeNull();
  });

  it('returns config when DOMAIN_ANALYZER_URL is set', () => {
    vi.stubEnv('DOMAIN_ANALYZER_URL', 'https://analyzer.example.com/');
    const cfg = getEnrichmentConfig();
    expect(cfg).not.toBeNull();
    expect(cfg?.url).toBe('https://analyzer.example.com');
    expect(cfg?.timeoutMs).toBe(2000);
  });

  it('reads custom timeout from env', () => {
    vi.stubEnv('DOMAIN_ANALYZER_URL', 'https://a.com');
    vi.stubEnv('DOMAIN_ANALYZER_TIMEOUT_MS', '500');
    const cfg = getEnrichmentConfig();
    expect(cfg?.timeoutMs).toBe(500);
  });
});

describe('enrichDomain', () => {
  it('returns signals from a successful response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        keywords_top_100: 42,
        traffic: 1500,
        backlinks: 10,
        domain_age_years: 3.5,
      }),
    });

    const signals = await enrichDomain('example.com', config);
    expect(signals).not.toBeNull();
    expect(signals?.keywordsTop100).toBe(42);
    expect(signals?.traffic).toBe(1500);
    expect(signals?.backlinks).toBe(10);
    expect(signals?.domainAgeYears).toBe(3.5);
  });

  it('returns null on HTTP error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const signals = await enrichDomain('error.com', config);
    expect(signals).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const signals = await enrichDomain('down.com', config);
    expect(signals).toBeNull();
  });

  it('returns null when all signals are zero', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ keywords_top_100: 0, traffic: 0, backlinks: 0 }),
    });
    const signals = await enrichDomain('empty.com', config);
    expect(signals).toBeNull();
  });

  it('returns partial signals when some fields are present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ keywords_top_100: 0, traffic: 500 }),
    });
    const signals = await enrichDomain('partial.com', config);
    expect(signals).not.toBeNull();
    expect(signals?.traffic).toBe(500);
    expect(signals?.keywordsTop100).toBe(0);
  });

  it('constructs correct URL with encoded domain', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ keywords_top_100: 1, traffic: 0, backlinks: 0 }),
    });
    await enrichDomain('test domain.com', config);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://analyzer.test/analyze?domain=test%20domain.com',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('handles invalid response data gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => 'not an object',
    });
    const signals = await enrichDomain('bad-data.com', config);
    expect(signals).toBeNull();
  });
});
