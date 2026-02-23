/**
 * Webhook management and delivery system.
 * Stores webhook registrations, delivers notifications with retries,
 * and supports HMAC-SHA256 payload signing.
 */

import { randomUUID, createHmac } from 'node:crypto';

export interface Webhook {
  id: string;
  url: string;
  secret?: string;
  status: 'active' | 'failing' | 'disabled';
  createdAt: string;
}

export interface WebhookPayload {
  event: string;
  data: unknown;
  timestamp: string;
}

interface DeliveryAttempt {
  webhookId: string;
  payload: WebhookPayload;
  attempt: number;
  httpStatus?: number;
  error?: string;
  timestamp: string;
}

const webhooks = new Map<string, Webhook>();
const deliveryLog: DeliveryAttempt[] = [];

/** Max delivery log entries to keep. */
const MAX_LOG_ENTRIES = 1000;

/** Retry delays in ms: 1s, 5s, 30s. */
const RETRY_DELAYS = [1000, 5000, 30_000];

/** SSRF protection: disallow private IP ranges in webhook URLs. */
function isPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === '::1' ||
      host === '[::1]'
    );
  } catch {
    return true;
  }
}

/** Register a new webhook. Returns the webhook or an error string. */
export function registerWebhook(url: string, secret?: string): Webhook | string {
  if (!url.startsWith('https://')) {
    return 'Webhook URL must use HTTPS';
  }

  if (isPrivateUrl(url)) {
    return 'Webhook URL cannot point to private/internal addresses';
  }

  const webhook: Webhook = {
    id: randomUUID(),
    url,
    ...(secret !== undefined ? { secret } : {}),
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  webhooks.set(webhook.id, webhook);
  return webhook;
}

/** List all registered webhooks. */
export function listWebhooks(): Webhook[] {
  return Array.from(webhooks.values());
}

/** Get a webhook by ID. */
export function getWebhook(id: string): Webhook | undefined {
  return webhooks.get(id);
}

/** Update a webhook URL or secret. */
export function updateWebhook(
  id: string,
  updates: { url?: string; secret?: string },
): Webhook | string {
  const webhook = webhooks.get(id);
  if (!webhook) return 'Webhook not found';

  if (updates.url !== undefined) {
    if (!updates.url.startsWith('https://')) {
      return 'Webhook URL must use HTTPS';
    }
    if (isPrivateUrl(updates.url)) {
      return 'Webhook URL cannot point to private/internal addresses';
    }
    webhook.url = updates.url;
  }

  if (updates.secret !== undefined) {
    webhook.secret = updates.secret;
  }

  webhook.status = 'active';
  return webhook;
}

/** Delete a webhook. */
export function deleteWebhook(id: string): boolean {
  return webhooks.delete(id);
}

/** Compute HMAC-SHA256 signature for a payload. */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Deliver a webhook notification asynchronously with retries. */
export async function deliverWebhook(
  webhook: Webhook,
  event: string,
  data: unknown,
): Promise<void> {
  if (webhook.status === 'disabled') return;

  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);
  let lastError = '';

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] ?? 30_000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'checkindex-webhook/1.0',
      };

      if (webhook.secret) {
        headers['X-Checkindex-Signature'] = signPayload(body, webhook.secret);
      }

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });

      logDelivery(webhook.id, payload, attempt + 1, res.status);

      if (res.ok) {
        if (webhook.status === 'failing') {
          webhook.status = 'active';
        }
        return;
      }

      lastError = `HTTP ${String(res.status)}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logDelivery(webhook.id, payload, attempt + 1, undefined, lastError);
    }
  }

  // All retries exhausted
  webhook.status = 'failing';
  console.warn(`[webhook] All retries failed for ${webhook.id}: ${lastError}`);
}

/** Fire webhooks for a given event to all active webhooks (non-blocking). */
export function fireWebhooks(event: string, data: unknown): void {
  for (const webhook of webhooks.values()) {
    if (webhook.status !== 'disabled') {
      void deliverWebhook(webhook, event, data);
    }
  }
}

/** Log a delivery attempt. */
function logDelivery(
  webhookId: string,
  payload: WebhookPayload,
  attempt: number,
  httpStatus?: number,
  error?: string,
): void {
  deliveryLog.push({
    webhookId,
    payload,
    attempt,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    ...(error !== undefined ? { error } : {}),
    timestamp: new Date().toISOString(),
  });

  // Trim log
  if (deliveryLog.length > MAX_LOG_ENTRIES) {
    deliveryLog.splice(0, deliveryLog.length - MAX_LOG_ENTRIES);
  }
}

/** Get recent delivery log entries for a webhook. */
export function getDeliveryLog(webhookId: string, limit = 20): DeliveryAttempt[] {
  return deliveryLog.filter((entry) => entry.webhookId === webhookId).slice(-limit);
}
