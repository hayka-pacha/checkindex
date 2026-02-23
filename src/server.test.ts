import { describe, it, expect, vi, afterEach } from 'vitest';
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
});
