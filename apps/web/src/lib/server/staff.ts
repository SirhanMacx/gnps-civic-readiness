/**
 * Staff user management used by /admin/users.
 *
 * Staff (counselors, SCRC committee members, teachers, admins) authenticate
 * via the self-hosted magic-link flow. The /users table is the source of
 * truth; inviteStaff provisions the row, and the user requests their own
 * one-time sign-in link from /login from then on. We do NOT auto-mail an
 * invite link — the admin shares the portal URL directly.
 *
 * `inviteStaff` provisions the staff row. If the email already exists in
 * `users` the call fails fast (we don't silently re-invite).
 *
 * `removeStaff` hard-deletes the row. The audit_log row preserves the
 * removed identity so historical references still resolve.
 */

import { supabaseAdmin } from './supabase.js';
import type { StaffRole } from '../../app.d.ts';

export interface StaffRow {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface InviteStaffInput {
  email: string;
  role: StaffRole;
  fullName: string;
  invitedBy: string;
}

export interface InviteStaffResult {
  ok: boolean;
  userId?: string;
  error?: string;
}

export interface UpdateRoleInput {
  userId: string;
  newRole: StaffRole;
  editorId: string;
}

export interface RemoveStaffInput {
  userId: string;
  removedBy: string;
}

const VALID_ROLES = new Set<StaffRole>(['counselor', 'scrc_member', 'teacher', 'admin']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rowToStaff(r: Record<string, unknown>): StaffRow {
  return {
    id: String(r.id ?? ''),
    email: String(r.email ?? ''),
    fullName: String(r.full_name ?? ''),
    role: String(r.role ?? 'counselor') as StaffRole,
    createdAt: String(r.created_at ?? ''),
    lastLoginAt: r.last_login_at ? String(r.last_login_at) : null
  };
}

export async function listStaff(): Promise<StaffRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('users')
    .select('id, email, full_name, role, created_at, last_login_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(rowToStaff);
}

/**
 * Provision a staff member by email and create the matching `users` row.
 *
 * - Email is normalized to lowercase for storage + later magic-link issuance.
 * - If the email already exists in `users`, we fail fast (the admin should
 *   `updateStaffRole` instead of duplicating).
 * - This call does not send any email. After provisioning, the staff member
 *   visits /login and requests their own one-time sign-in link.
 */
export async function inviteStaff(input: InviteStaffInput): Promise<InviteStaffResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'invalid email' };
  if (!fullName) return { ok: false, error: 'full_name is required' };
  if (!VALID_ROLES.has(input.role)) return { ok: false, error: 'invalid role' };

  const sb = supabaseAdmin();

  // Check for an existing row first to avoid surfacing a unique-violation.
  const { data: existing } = await sb
    .from('users')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: 'A staff user with that email already exists' };
  }

  const { data: inserted, error: insErr } = await sb
    .from('users')
    .insert({
      email,
      full_name: fullName,
      role: input.role
    })
    .select('id')
    .single();
  if (insErr || !inserted) {
    return { ok: false, error: `users insert failed: ${insErr?.message ?? 'unknown'}` };
  }

  await sb.from('audit_log').insert({
    actor_id: input.invitedBy,
    actor_kind: 'admin',
    action: 'admin_invited_staff',
    target_type: 'users',
    target_id: String(inserted.id),
    data: { email, role: input.role, full_name: fullName }
  });

  return { ok: true, userId: String(inserted.id) };
}

export async function updateStaffRole(input: UpdateRoleInput): Promise<StaffRow> {
  if (!VALID_ROLES.has(input.newRole)) {
    throw new Error('invalid role');
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('users')
    .update({ role: input.newRole })
    .eq('id', input.userId)
    .select('id, email, full_name, role, created_at, last_login_at')
    .single();
  if (error || !data) {
    throw new Error(`users update failed: ${error?.message ?? 'unknown'}`);
  }

  await sb.from('audit_log').insert({
    actor_id: input.editorId,
    actor_kind: 'admin',
    action: 'admin_updated_staff_role',
    target_type: 'users',
    target_id: input.userId,
    data: { new_role: input.newRole, email: data.email }
  });

  return rowToStaff(data);
}

/**
 * Hard-delete the staff user row. The `audit_log` keeps a permanent record of
 * the removal (and the relevant fields are denormalized into audit_log.data),
 * so removing the row does not lose audit defensibility.
 *
 * If the schema later grows a `deactivated_at` column we should switch this
 * to a soft delete; documented in module comment.
 */
export async function removeStaff(input: RemoveStaffInput): Promise<{ ok: boolean; error?: string }> {
  const sb = supabaseAdmin();
  // Capture identity for the audit row before deletion.
  const { data: target, error: lookupErr } = await sb
    .from('users')
    .select('id, email, full_name, role')
    .eq('id', input.userId)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: `lookup failed: ${lookupErr.message}` };
  if (!target) return { ok: false, error: 'user not found' };

  const { error: delErr } = await sb.from('users').delete().eq('id', input.userId);
  if (delErr) return { ok: false, error: `users delete failed: ${delErr.message}` };

  await sb.from('audit_log').insert({
    actor_id: input.removedBy,
    actor_kind: 'admin',
    action: 'admin_removed_staff',
    target_type: 'users',
    target_id: input.userId,
    data: {
      removed_email: target.email,
      removed_full_name: target.full_name,
      removed_role: target.role
    }
  });

  return { ok: true };
}
