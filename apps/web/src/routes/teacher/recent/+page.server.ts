import { requireRole } from '$server/auth.js';
import { listMyPushes } from '$server/teacher-push.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async (event) => {
  const user =
    (await requireRole(event, 'teacher').catch(() => null)) ??
    (await requireRole(event, 'scrc_member').catch(() => null)) ??
    (await requireRole(event, 'admin'));
  const pushes = await listMyPushes(user.id, 50);
  return { user, pushes };
};
