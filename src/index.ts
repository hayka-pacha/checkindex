/**
 * checkindex — Google indexation verification service
 *
 * Entry point. Currently exports the core checker for library use.
 * HTTP server will be added in a subsequent iteration.
 */
export { checkIndex } from './checkers/index.js';
export type {
  IndexCheckRequest,
  IndexCheckResult,
  HeuristicSignals,
  Confidence,
  CheckMethod,
} from './types.js';
