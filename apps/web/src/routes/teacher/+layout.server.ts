import { requireAnyRole } from '$server/auth.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async (event) => {
  // Teachers, SCRC members, and admins can access /teacher/* — counselors
  // already have a richer view at /counselor.
  const user = await requireAnyRole(event, ['teacher', 'scrc_member', 'admin']);
  return { user };
};
