/**
 * Readiness endpoint for orchestrators / load balancers that want a deeper
 * check than /health. /health proves the Node process is up; /ready proves
 * the database is reachable too.
 *
 * 200 → app + DB are ready to serve traffic.
 * 503 → DB is unreachable (or a transient hiccup); orchestrator should hold
 *       traffic off this instance until /ready returns 200 again.
 */

import type { RequestHandler } from './$types.js';
import { getSql } from '$lib/server/db.js';

export const GET: RequestHandler = async () => {
  try {
    const sql = getSql();
    await sql`select 1`;
    return new Response(
      JSON.stringify({
        status: 'ready',
        service: 'gnps-civic-readiness',
        database: 'ok',
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        status: 'not_ready',
        service: 'gnps-civic-readiness',
        database: 'unavailable',
        error: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      }
    );
  }
};
