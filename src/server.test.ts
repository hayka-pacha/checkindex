import { describe, it, expect, vi, afterEach } from 'vitest';

// Set high rate limit before server module loads (hoisted before imports)
vi.hoisted(() => {
  process.env['RATE_LIMIT_PER_MINUTE'] = '10000';
});

import { app } from './server.js';

// Mock the checkIndex orchestrator so tests don't hit external APIs
vi.mock('./checkers/index.js', () => ({
  checkIndex: vi.fn().mockResolvedValue({
    indexed: true,
    confidence: 'high',
    method: 'heuristic',
    signals: { keywordsTop100: 50, traffic: 200, backlinks: 10 },
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});

describe('GET /check', () => {
  it('returns indexation result for a valid domain', async () => {
    const res = await app.request('/check?domain=example.com');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { indexed: boolean; confidence: string };
    expect(body.indexed).toBe(true);
    expect(body.confidence).toBe('high');
  });

  it('returns indexation result for a valid url', async () => {
    const res = await app.request('/check?url=https://example.com/page');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { indexed: boolean };
    expect(body.indexed).toBe(true);
  });

  it('returns 400 when neither domain nor url is provided', async () => {
    const res = await app.request('/check');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid request');
  });

  it('passes signal query params to checkIndex and returns heuristic result', async () => {
    const { checkIndex } = await import('./checkers/index.js');
    const res = await app.request(
      '/check?domain=signals-test.com&keywordsTop100=50&traffic=200&backlinks=10',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { indexed: boolean; method: string; signals: unknown };
    expect(body.indexed).toBe(true);
    expect(body.method).toBe('heuristic');
    expect(body.signals).toBeDefined();
    expect(vi.mocked(checkIndex)).toHaveBeenCalledWith(
      expect.objectContaining({
        signals: expect.objectContaining({
          keywordsTop100: 50,
          traffic: 200,
          backlinks: 10,
        }),
      }),
    );
  });

  it('calls checkIndex without signals when none provided', async () => {
    const { checkIndex } = await import('./checkers/index.js');
    await app.request('/check?domain=nosignals.com');
    expect(vi.mocked(checkIndex)).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'nosignals.com',
      }),
    );
    const call = vi.mocked(checkIndex).mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(call?.['signals']).toBeUndefined();
  });

  it('normalizes www domain param by stripping www prefix', async () => {
    const { checkIndex } = await import('./checkers/index.js');
    await app.request('/check?domain=www.normalize-test.com');
    expect(vi.mocked(checkIndex)).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'normalize-test.com',
      }),
    );
  });

  it('returns cached result on second request', async () => {
    const { checkIndex } = await import('./checkers/index.js');
    await app.request('/check?domain=cached-domain.com');
    await app.request('/check?domain=cached-domain.com');
    expect(vi.mocked(checkIndex)).toHaveBeenCalledTimes(1);
  });
});

describe('POST /check/batch', () => {
  it('returns results for multiple domains', async () => {
    const res = await app.request('/check/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: ['a.com', 'b.com'] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Record<string, unknown> };
    expect(Object.keys(body.results)).toHaveLength(2);
    expect(body.results['a.com']).toBeDefined();
    expect(body.results['b.com']).toBeDefined();
  });

  it('returns 400 for invalid body', async () => {
    const res = await app.request('/check/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrong: true }),
    });
    expect(res.status).toBe(400);
  });

  it('caps batch at 50 domains', async () => {
    const { checkIndex } = await import('./checkers/index.js');
    const domains = Array.from({ length: 60 }, (_, i) => `domain${String(i)}.com`);
    const res = await app.request('/check/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(checkIndex).mock.calls.length).toBeLessThanOrEqual(50);
  });

  it('normalizes www-prefixed domains in batch result keys', async () => {
    const res = await app.request('/check/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: ['www.batch-norm.com'] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Record<string, unknown> };
    expect(body.results['batch-norm.com']).toBeDefined();
    expect(body.results['www.batch-norm.com']).toBeUndefined();
  });
});

describe('Rate limiting', () => {
  it('includes rate limit headers on successful response', async () => {
    const res = await app.request('/check?domain=ratelimit-header-test.com', {
      headers: { 'X-Forwarded-For': '10.0.0.99' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('does not rate limit /health endpoint', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
  });
});

describe('Edge cases', () => {
  it('returns 400 for /check with empty domain param', async () => {
    const res = await app.request('/check?domain=');
    expect(res.status).toBe(400);
  });

  it('returns 400 for /check with invalid url param', async () => {
    const res = await app.request('/check?url=not-a-url');
    expect(res.status).toBe(400);
  });
});
