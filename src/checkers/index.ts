import { checkIndexHeuristic } from './heuristic.js';
import { checkIndexGoogleCSE } from './google-cse.js';
import type { HeuristicSignals, IndexCheckResult } from '../types.js';

interface CheckOptions {
  /** Domain to verify (e.g. "example.com") */
  domain: string;
  /** SEO signals for heuristic check. If omitted, falls back to Google CSE directly. */
  signals?: HeuristicSignals;
  /** Force Google CSE even when heuristic confidence is high */
  forceCSE?: boolean;
}

/**
 * Orchestrates the two-layer indexation check strategy:
 * 1. Heuristic (free, instant) — covers ~90% of cases
 * 2. Google CSE (paid fallback) — for ambiguous cases with low confidence
 */
export async function checkIndex(options: CheckOptions): Promise<IndexCheckResult> {
  const { domain, signals, forceCSE = false } = options;

  if (signals && !forceCSE) {
    const heuristicResult = checkIndexHeuristic(signals);

    if (heuristicResult.confidence !== 'low') {
      return heuristicResult;
    }
  }

  return checkIndexGoogleCSE(domain);
}
