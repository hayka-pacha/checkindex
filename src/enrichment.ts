/**
 * Domain-analyzer enrichment client.
 * Fetches SEO signals (keywords, traffic, backlinks, domainAge) from an external
 * domain-analyzer service when configured via DOMAIN_ANALYZER_URL.
 */

import type { HeuristicSignals } from './types.js';

export interface EnrichmentConfig {
  /** Base URL of the domain-analyzer API. Empty/undefined = disabled. */
  url: string;
  /** Request timeout in milliseconds. */
  timeoutMs: number;
}

interface AnalyzerResponse {
  keywords_top_100?: number;
  traffic?: number;
  backlinks?: number;
  domain_age_years?: number;
}

/**
 * Build enrichment config from environment variables.
 * Returns null if enrichment is disabled (no URL configured).
 */
export function getEnrichmentConfig(): EnrichmentConfig | null {
  const url = process.env['DOMAIN_ANALYZER_URL'];
  if (!url) return null;

  return {
    url: url.replace(/\/+$/, ''),
    timeoutMs: parseInt(process.env['DOMAIN_ANALYZER_TIMEOUT_MS'] ?? '2000', 10),
  };
}

/**
 * Fetch SEO signals from domain-analyzer for a given domain.
 * Returns null if enrichment fails or data is invalid.
 */
export async function enrichDomain(
  domain: string,
  config: EnrichmentConfig,
): Promise<HeuristicSignals | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, config.timeoutMs);

    const res = await fetch(`${config.url}/analyze?domain=${encodeURIComponent(domain)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[enrichment] domain-analyzer returned ${String(res.status)} for ${domain}`);
      return null;
    }

    const data: unknown = await res.json();
    return parseAnalyzerResponse(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[enrichment] Failed to enrich ${domain}: ${message}`);
    return null;
  }
}

/** Parse and validate the analyzer response into HeuristicSignals. */
function parseAnalyzerResponse(data: unknown): HeuristicSignals | null {
  if (typeof data !== 'object' || data === null) return null;
  const resp = data as AnalyzerResponse;

  const keywords = Number(resp.keywords_top_100) || 0;
  const traffic = Number(resp.traffic) || 0;
  const backlinks = Number(resp.backlinks) || 0;
  const age = Number(resp.domain_age_years) || undefined;

  // At least one useful signal must be present
  if (keywords === 0 && traffic === 0 && backlinks === 0 && age === undefined) {
    return null;
  }

  return {
    keywordsTop100: keywords,
    traffic,
    backlinks,
    ...(age !== undefined ? { domainAgeYears: age } : {}),
  };
}
