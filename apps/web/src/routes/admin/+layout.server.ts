/**
 * Admin route gate. Redirects to /login (anon) or 403s (wrong role).
 */

import { requireRole } from '$server/auth.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async (event) => {
  const user = await requireRole(event, 'admin');
  return { user };
};
