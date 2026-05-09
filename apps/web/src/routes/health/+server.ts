/**
 * Health check endpoint for container orchestration / load balancers.
 * Returns 200 with a JSON body when the app is alive. Used by Docker's HEALTHCHECK.
 *
 * Currently does NOT touch the database — a successful response only proves the
 * Node process is up and the SvelteKit router is serving. We deliberately keep
 * it lightweight so a transient DB hiccup doesn't trigger container restarts.
 *
 * For a deeper readiness probe (DB reachable), use /ready instead.
 */

import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = () => {
  return new Response(
    JSON.stringify({
      status: 'ok',
      service: 'gnps-civic-readiness',
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    }
  );
};
