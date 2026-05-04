import { requireRole } from '$server/auth.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async (event) => {
  // Teachers, SCRC members, and admins can access /teacher/* — counselors
  // already have a richer view at /counselor.
  const user =
    (await requireRole(event, 'teacher').catch(async () => null)) ??
    (await requireRole(event, 'scrc_member').catch(async () => null)) ??
    (await requireRole(event, 'admin'));
  return { user };
};
