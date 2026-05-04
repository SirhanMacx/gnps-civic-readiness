/**
 * Per-student NYSED audit-pack PDF endpoint.
 *
 * Phase 1 placeholder — Wave 3 will wire this up to the @gnps-civic/nysed-export
 * package which generates the per-student PDF described in spec §4.5.
 *
 * Returns 501 Not Implemented for now so the link is visible but doesn't
 * silently 404. The counselor page links to this route as a forward-compat
 * placeholder.
 */

import { error } from '@sveltejs/kit';
import { requireRole } from '$server/auth.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async (event) => {
  await requireRole(event, 'counselor');
  // Verify the student exists so we 404-not-found rather than 501-everywhere.
  // Lightweight check; full PDF generation lands in Wave 3.
  throw error(
    501,
    `NYSED audit-pack PDF for student ${event.params.id} is not yet implemented. Coming in Wave 3.`,
  );
};
