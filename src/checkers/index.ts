import { checkIndexHeuristic } from './heuristic.js';
import { checkIndexGoogleCSE } from './google-cse.js';
import { enrichDomain, getEnrichmentConfig } from '../enrichment.js';
import type { HeuristicSignals, IndexCheckResult } from '../types.js';

interface CheckOptions {
  /** Domain to verify (e.g. "example.com") */
  domain: string;
  /** SEO signals for heuristic check. If omitted, auto-enrichment is attempted. */
  signals?: HeuristicSignals;
  /** Force Google CSE even when heuristic confidence is high */
  forceCSE?: boolean;
}

/**
 * Orchestrates the two-layer indexation check strategy:
 * 1. Heuristic (free, instant) — covers ~90% of cases
 * 2. Google CSE (paid fallback) — for ambiguous cases with low confidence
 *
 * CSE errors are caught and degraded gracefully:
 * - If heuristic ran, return its result with original confidence
 * - If no heuristic (no signals), return safe fallback (indexed: false, confidence: low)
 */
export async function checkIndex(options: CheckOptions): Promise<IndexCheckResult> {
  const { domain, forceCSE = false } = options;

  // Manual signals take precedence; otherwise try auto-enrichment
  let signals = options.signals;
  if (!signals && !forceCSE) {
    const enrichConfig = getEnrichmentConfig();
    if (enrichConfig) {
      signals = (await enrichDomain(domain, enrichConfig)) ?? undefined;
    }
  }

  let heuristicResult: IndexCheckResult | undefined;

  if (signals && !forceCSE) {
    heuristicResult = checkIndexHeuristic(signals);

    if (heuristicResult.confidence !== 'low') {
      return heuristicResult;
    }
  }

  try {
    return await checkIndexGoogleCSE(domain);
  } catch {
    // Graceful degradation: return heuristic result or safe fallback
    return (
      heuristicResult ?? {
        indexed: false,
        confidence: 'low',
        method: 'heuristic',
      }
    );
  }
}
