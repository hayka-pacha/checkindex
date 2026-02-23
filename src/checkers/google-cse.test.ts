import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkIndexGoogleCSE } from './google-cse.js';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubEnv('GOOGLE_CSE_API_KEY', 'test-key');
  vi.stubEnv('GOOGLE_CSE_CX', 'test-cx');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('checkIndexGoogleCSE', () => {
  it('returns indexed=true with page count when totalResults > 0', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ searchInformation: { totalResults: '42' } }),
    });

    const result = await checkIndexGoogleCSE('example.com');

    expect(result.indexed).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.method).toBe('google-cse');
    expect(result.indexedPagesCount).toBe(42);
  });

  it('returns indexed=false when totalResults is 0', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ searchInformation: { totalResults: '0' } }),
    });

    const result = await checkIndexGoogleCSE('expired.xyz');

    expect(result.indexed).toBe(false);
    expect(result.indexedPagesCount).toBe(0);
  });

  it('throws on HTTP error (non-200 status)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    await expect(checkIndexGoogleCSE('rate-limited.com')).rejects.toThrow(
      'Google CSE API error: 429 Too Many Requests',
    );
  });

  it('throws when API returns error object in body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: { code: 403, message: 'Forbidden' } }),
    });

    await expect(checkIndexGoogleCSE('forbidden.com')).rejects.toThrow(
      'Google CSE error 403: Forbidden',
    );
  });

  it('throws when GOOGLE_CSE_API_KEY is not set', async () => {
    vi.stubEnv('GOOGLE_CSE_API_KEY', '');

    await expect(checkIndexGoogleCSE('no-key.com')).rejects.toThrow(
      'GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX must be set',
    );
  });

  it('throws when GOOGLE_CSE_CX is not set', async () => {
    vi.stubEnv('GOOGLE_CSE_CX', '');

    await expect(checkIndexGoogleCSE('no-cx.com')).rejects.toThrow(
      'GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX must be set',
    );
  });

  it('handles missing searchInformation gracefully (returns 0)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await checkIndexGoogleCSE('weird-response.com');

    expect(result.indexed).toBe(false);
    expect(result.indexedPagesCount).toBe(0);
  });

  it('constructs the correct Google CSE URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ searchInformation: { totalResults: '1' } }),
    });

    await checkIndexGoogleCSE('url-test.com');

    const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(calledUrl.origin).toBe('https://www.googleapis.com');
    expect(calledUrl.pathname).toBe('/customsearch/v1');
    expect(calledUrl.searchParams.get('q')).toBe('site:url-test.com');
    expect(calledUrl.searchParams.get('key')).toBe('test-key');
    expect(calledUrl.searchParams.get('cx')).toBe('test-cx');
    expect(calledUrl.searchParams.get('num')).toBe('1');
  });
});
