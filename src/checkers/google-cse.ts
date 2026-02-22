import type { IndexCheckResult } from '../types.js';

interface GoogleCSEResponse {
  searchInformation?: {
    totalResults?: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Verifies indexation via Google Custom Search API (site: operator).
 *
 * Requires GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX environment variables.
 * Free tier: 100 queries/day. Beyond: $5/1000 queries.
 */
export async function checkIndexGoogleCSE(domain: string): Promise<IndexCheckResult> {
  const apiKey = process.env['GOOGLE_CSE_API_KEY'];
  const cx = process.env['GOOGLE_CSE_CX'];

  if (!apiKey || !cx) {
    throw new Error('GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX must be set');
  }

  const query = `site:${domain}`;
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '1');

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Google CSE API error: ${String(response.status)} ${response.statusText}`);
  }

  const data = (await response.json()) as GoogleCSEResponse;

  if (data.error) {
    throw new Error(`Google CSE error ${String(data.error.code)}: ${data.error.message}`);
  }

  const totalResults = parseInt(data.searchInformation?.totalResults ?? '0', 10);

  return {
    indexed: totalResults > 0,
    confidence: 'high',
    method: 'google-cse',
    indexedPagesCount: totalResults,
  };
}
