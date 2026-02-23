/**
 * checkindex — Google indexation verification service
 *
 * Start the HTTP server:
 *   pnpm dev
 *
 * Or import the core checker as a library:
 *   import { checkIndex } from 'checkindex'
 */
import { serve } from '@hono/node-server';
import { app } from './server.js';

export { checkIndex } from './checkers/index.js';
export type {
  IndexCheckRequest,
  IndexCheckResult,
  HeuristicSignals,
  Confidence,
  CheckMethod,
} from './types.js';

const port = parseInt(process.env['PORT'] ?? '3000', 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`checkindex running on http://localhost:${String(port)}`);
});
