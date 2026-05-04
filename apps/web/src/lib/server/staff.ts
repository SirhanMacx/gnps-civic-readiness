/**
 * Staff user management used by /admin/users.
 *
 * Phase 1 staff (counselors, SCRC committee, admins) authenticate via Supabase
 * magic links. The /users table mirrors the auth user by email; we treat the
 * `users.email` column as the join key (case-insensitive, normalized to
 * lowercase on insert).
 *
 * `inviteStaff` issues a Supabase magic-link invite via supabase.auth.admin
 * and inserts the staff row in one shot. If the email already exists in
 * `users` the call fails fast (we don't silently re-invite).
 *
 * `removeStaff` is a soft delete: the row is kept (so audit history still
 * resolves the user's name) but the role flips to a sentinel `'decommissioned'`
 * value that fails the `requireRole` gate at the route layer. Because the
 * Postgres `user_role` enum doesn't include that value yet, we represent the
 * soft-delete by overwriting the email + adding a `deactivated_at` column we
 * mirror in the audit_log; the actual `role` enum value is left unchanged
 * but we set `caseload_filter.deactivated = true` and the route layer is
 * expected to treat any `users` row with that flag as logged-out.
 *
 * Until the schema gains a proper `deactivated_at` column, removeStaff opts
 * for option B: hard-delete the row. Documented inline in `removeStaff`.
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

const VALID_ROLES = new Set<StaffRole>(['counselor', 'scrc_member', 'admin']);
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
 * Invite a staff member by email and create the matching `users` row.
 *
 * - Email is normalized to lowercase for storage + the magic-link send.
 * - If the email already exists in `users`, we fail fast (the admin should
 *   `updateStaffRole` instead of duplicating).
 * - We try to issue a Supabase magic-link invite; if the auth admin call is
 *   not available (e.g. tests), we still create the `users` row and return
 *   the failure as a warning in `error`.
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

  // Best-effort Supabase magic-link send. Available only when the service-role
  // client has auth.admin (it does in production; the unit-test mock can omit).
  let authWarning: string | undefined;
  try {
    // Some Supabase JS versions expose admin via .auth.admin; older or
    // mocked clients may not. Guard with a typeof check.
    const adminAuth = (sb as unknown as { auth?: { admin?: { inviteUserByEmail?: Function } } })
      .auth?.admin?.inviteUserByEmail;
    if (typeof adminAuth === 'function') {
      const res = await adminAuth.call((sb as { auth: { admin: unknown } }).auth.admin, email);
      const err =
        (res && typeof res === 'object' && 'error' in res ? (res as { error: unknown }).error : null);
      if (err && typeof err === 'object' && 'message' in err) {
        authWarning = `magic-link send failed: ${(err as { message: string }).message}`;
      }
    } else {
      authWarning = 'auth.admin.inviteUserByEmail unavailable in this environment';
    }
  } catch (e) {
    authWarning = `magic-link send threw: ${e instanceof Error ? e.message : String(e)}`;
  }

  await sb.from('audit_log').insert({
    actor_id: input.invitedBy,
    actor_kind: 'admin',
    action: 'admin_invited_staff',
    target_type: 'users',
    target_id: String(inserted.id),
    data: { email, role: input.role, full_name: fullName, auth_warning: authWarning ?? null }
  });

  return { ok: true, userId: String(inserted.id), error: authWarning };
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
