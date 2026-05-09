/**
 * /admin/users — staff directory + invite / role-change / remove.
 */

import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import {
  inviteStaff,
  listStaff,
  removeStaff,
  updateStaffRole,
  type StaffRow
} from '$server/staff.js';
import { requireRole } from '$server/auth.js';
import type { StaffRole } from '../../../app.d.ts';

const VALID_ROLES = new Set<StaffRole>(['counselor', 'scrc_member', 'teacher', 'admin']);

export const load: PageServerLoad = async () => {
  const staff: StaffRow[] = await listStaff();
  return { staff };
};

export const actions: Actions = {
  invite: async (event) => {
    const user = await requireRole(event, 'admin');
    const fd = await event.request.formData();
    const email = String(fd.get('email') ?? '').trim();
    const fullName = String(fd.get('fullName') ?? '').trim();
    const roleRaw = String(fd.get('role') ?? 'counselor').trim();
    if (!VALID_ROLES.has(roleRaw as StaffRole)) {
      return fail(400, { inviteError: `invalid role: ${roleRaw}` });
    }
    const result = await inviteStaff({
      email,
      fullName,
      role: roleRaw as StaffRole,
      invitedBy: user.id
    });
    if (!result.ok) return fail(400, { inviteError: result.error ?? 'invite failed' });
    return {
      invited: { email, fullName, role: roleRaw, warning: result.error ?? null }
    };
  },

  updateRole: async (event) => {
    const user = await requireRole(event, 'admin');
    const fd = await event.request.formData();
    const userId = String(fd.get('userId') ?? '');
    const newRole = String(fd.get('newRole') ?? '');
    if (!userId) return fail(400, { roleError: 'missing userId' });
    if (!VALID_ROLES.has(newRole as StaffRole)) {
      return fail(400, { roleError: `invalid role: ${newRole}` });
    }
    try {
      const updated = await updateStaffRole({
        userId,
        newRole: newRole as StaffRole,
        editorId: user.id
      });
      return { roleUpdated: updated };
    } catch (e) {
      return fail(400, { roleError: e instanceof Error ? e.message : 'update failed' });
    }
  },

  remove: async (event) => {
    const user = await requireRole(event, 'admin');
    const fd = await event.request.formData();
    const userId = String(fd.get('userId') ?? '');
    if (!userId) return fail(400, { removeError: 'missing userId' });
    if (userId === user.id) {
      return fail(400, { removeError: 'cannot remove your own account' });
    }
    const result = await removeStaff({ userId, removedBy: user.id });
    if (!result.ok) return fail(400, { removeError: result.error ?? 'remove failed' });
    return { removed: { userId } };
  }
};
