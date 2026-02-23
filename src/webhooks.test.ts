import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  signPayload,
  deliverWebhook,
} from './webhooks.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('registerWebhook', () => {
  it('registers a valid HTTPS webhook', () => {
    const result = registerWebhook('https://hooks.example.com/callback');
    expect(typeof result).not.toBe('string');
    if (typeof result === 'string') return;
    expect(result.id).toBeDefined();
    expect(result.url).toBe('https://hooks.example.com/callback');
    expect(result.status).toBe('active');
  });

  it('rejects non-HTTPS URLs', () => {
    const result = registerWebhook('http://hooks.example.com/callback');
    expect(result).toBe('Webhook URL must use HTTPS');
  });

  it('rejects localhost URLs (SSRF protection)', () => {
    const result = registerWebhook('https://localhost/callback');
    expect(typeof result).toBe('string');
    expect(result).toContain('private');
  });

  it('rejects private IP ranges', () => {
    expect(typeof registerWebhook('https://192.168.1.1/hook')).toBe('string');
    expect(typeof registerWebhook('https://10.0.0.1/hook')).toBe('string');
    expect(typeof registerWebhook('https://172.16.0.1/hook')).toBe('string');
  });

  it('stores optional secret', () => {
    const result = registerWebhook('https://hooks.example.com/signed', 'my-secret');
    expect(typeof result).not.toBe('string');
    if (typeof result === 'string') return;
    expect(result.secret).toBe('my-secret');
  });
});

describe('CRUD operations', () => {
  it('lists all registered webhooks', () => {
    const initial = listWebhooks().length;
    registerWebhook('https://hooks.example.com/list-test-1');
    registerWebhook('https://hooks.example.com/list-test-2');
    expect(listWebhooks().length).toBeGreaterThanOrEqual(initial + 2);
  });

  it('gets a webhook by ID', () => {
    const wh = registerWebhook('https://hooks.example.com/get-test');
    if (typeof wh === 'string') return;
    const found = getWebhook(wh.id);
    expect(found).toBeDefined();
    expect(found?.url).toBe('https://hooks.example.com/get-test');
  });

  it('updates webhook URL', () => {
    const wh = registerWebhook('https://hooks.example.com/update-old');
    if (typeof wh === 'string') return;
    const updated = updateWebhook(wh.id, { url: 'https://hooks.example.com/update-new' });
    expect(typeof updated).not.toBe('string');
    if (typeof updated === 'string') return;
    expect(updated.url).toBe('https://hooks.example.com/update-new');
  });

  it('rejects update with invalid URL', () => {
    const wh = registerWebhook('https://hooks.example.com/update-fail');
    if (typeof wh === 'string') return;
    const result = updateWebhook(wh.id, { url: 'http://insecure.com/hook' });
    expect(typeof result).toBe('string');
  });

  it('deletes a webhook', () => {
    const wh = registerWebhook('https://hooks.example.com/delete-test');
    if (typeof wh === 'string') return;
    expect(deleteWebhook(wh.id)).toBe(true);
    expect(getWebhook(wh.id)).toBeUndefined();
  });

  it('returns false when deleting non-existent webhook', () => {
    expect(deleteWebhook('non-existent-id')).toBe(false);
  });
});

describe('signPayload', () => {
  it('produces a consistent HMAC-SHA256 signature', () => {
    const sig1 = signPayload('{"test":true}', 'secret');
    const sig2 = signPayload('{"test":true}', 'secret');
    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64); // SHA-256 hex
  });

  it('produces different signatures for different secrets', () => {
    const sig1 = signPayload('data', 'secret1');
    const sig2 = signPayload('data', 'secret2');
    expect(sig1).not.toBe(sig2);
  });
});

describe('deliverWebhook', () => {
  it('sends POST to webhook URL on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const wh = registerWebhook('https://hooks.example.com/deliver-test');
    if (typeof wh === 'string') return;

    await deliverWebhook(wh, 'check.completed', { domain: 'test.com' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.example.com/deliver-test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('includes signature header when secret is set', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const wh = registerWebhook('https://hooks.example.com/signed-deliver', 'test-secret');
    if (typeof wh === 'string') return;

    await deliverWebhook(wh, 'check.completed', { domain: 'signed.com' });

    const callHeaders = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(callHeaders?.['X-Checkindex-Signature']).toBeDefined();
  });

  it('does not include signature when no secret', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const wh = registerWebhook('https://hooks.example.com/no-sig-test');
    if (typeof wh === 'string') return;

    await deliverWebhook(wh, 'check.completed', { domain: 'unsigned.com' });

    const callHeaders = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(callHeaders?.['X-Checkindex-Signature']).toBeUndefined();
  });

  it('marks webhook as failing after all retries exhausted', async () => {
    vi.useFakeTimers();
    mockFetch.mockRejectedValue(new Error('Connection refused'));
    const wh = registerWebhook('https://hooks.example.com/fail-test');
    if (typeof wh === 'string') return;

    const delivery = deliverWebhook(wh, 'check.completed', { domain: 'fail.com' });

    // Advance through all retry delays: 1s, 5s, 30s
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(30_000);

    await delivery;

    // 1 initial + 3 retries = 4 attempts
    expect(mockFetch.mock.calls.length).toBe(4);
    expect(wh.status).toBe('failing');
    vi.useRealTimers();
  });
});
