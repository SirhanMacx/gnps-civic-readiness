/**
 * Counselor route gate. Redirects to /login (anon) or 403s (wrong role).
 *
 * Sample usage of getCurrentUser + requireRole — every page under /counselor
 * receives `data.user` typed as a StaffUser via the layout chain.
 */

import { requireRole } from '$server/auth.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async (event) => {
  const user = await requireRole(event, 'counselor');
  return { user };
};
