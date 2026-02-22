import type { HeuristicSignals, IndexCheckResult, Confidence } from '../types.js';

/**
 * Infers indexation status from SEO signals without any external API call.
 *
 * Confidence levels:
 * - high: keywords > 0 OR traffic > 0 (Google has indexed and ranked the site)
 * - medium: backlinks > 0 AND domain age > 1 year (likely indexed, no direct proof)
 * - low: no positive signals (probably not indexed or too new)
 */
export function checkIndexHeuristic(signals: HeuristicSignals): IndexCheckResult {
  const { keywordsTop100, traffic, backlinks, domainAgeYears } = signals;

  if (keywordsTop100 > 0 || traffic > 0) {
    return {
      indexed: true,
      confidence: 'high' as Confidence,
      method: 'heuristic',
      signals,
    };
  }

  const hasMeaningfulBacklinks = backlinks > 0;
  const isEstablishedDomain = (domainAgeYears ?? 0) > 1;

  if (hasMeaningfulBacklinks && isEstablishedDomain) {
    return {
      indexed: true,
      confidence: 'medium' as Confidence,
      method: 'heuristic',
      signals,
    };
  }

  return {
    indexed: false,
    confidence: 'low' as Confidence,
    method: 'heuristic',
    signals,
  };
}
