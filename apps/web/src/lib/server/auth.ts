/**
 * Server-side auth helpers for the GNPS Civic Readiness Portal.
 *
 * Self-hosted JWT session cookie + staff lookup against `public.users`.
 *
 * - getCurrentUser(event):
 *     Reads the session cookie, verifies the JWT, joins to the staff
 *     `users` table by id (falling back to email when the id is missing),
 *     returns a StaffUser or null. Anonymous requests resolve to null
 *     without raising.
 *
 * - requireRole(event, role):
 *     Same redirect/error semantics as before — anonymous → 303 to /login,
 *     wrong role → 403, matching role → returns the user.
 *
 * - getServerUserByEmail(email):
 *     Internal helper used by the magic-link callback to translate an email
 *     into a `users` row before signing the JWT.
 */

import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { supabaseAdmin } from './supabase.js';
import { readSessionCookie, verifySession } from './session.js';
import type { StaffRole, StaffUser } from '../../app.d.ts';

interface UserRow {
  id: string;
  email: string;
  role: StaffRole;
  full_name: string | null;
}

/**
 * Look up a staff user by id. Returns null when the row is missing —
 * e.g. an admin removed the row after the JWT was minted. The caller
 * treats that as logged-out.
 */
export async function getStaffUserById(id: string): Promise<StaffUser | null> {
  const sb = supabaseAdmin();
  const { data, error: dbErr } = await sb
    .from('users')
    .select('id, email, role, full_name')
    .eq('id', id)
    .maybeSingle();
  if (dbErr || !data) return null;
  return rowToStaff(data as unknown as UserRow);
}

/**
 * Look up a staff user by email (case-insensitive). Used by the magic-link
 * callback to bridge from the auth-tokens row to the `users` row.
 */
export async function getStaffUserByEmail(email: string): Promise<StaffUser | null> {
  const sb = supabaseAdmin();
  const { data, error: dbErr } = await sb
    .from('users')
    .select('id, email, role, full_name')
    .ilike('email', email)
    .maybeSingle();
  if (dbErr || !data) return null;
  return rowToStaff(data as unknown as UserRow);
}

function rowToStaff(row: UserRow): StaffUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    fullName: row.full_name ?? row.email
  };
}

/**
 * Read the currently logged-in user from the session cookie. Returns null
 * when no cookie is present, the JWT is invalid/expired, or the user no
 * longer exists in `public.users`.
 */
export async function getCurrentUser(event: RequestEvent): Promise<StaffUser | null> {
  const jwt = readSessionCookie(event.cookies);
  if (!jwt) return null;
  const payload = await verifySession(jwt);
  if (!payload) return null;
  return getStaffUserById(payload.userId);
}

/**
 * Gate a route to a specific staff role. Use inside +layout.server.ts files
 * for /counselor, /scrc, /admin.
 *
 * - Anonymous → 303 redirect to /login (with optional ?next= return path)
 * - Logged in but different role → 403
 *
 * Returns the StaffUser when authorization passes.
 */
export async function requireRole(
  event: RequestEvent,
  role: StaffRole
): Promise<StaffUser> {
  const user = event.locals.user ?? (await getCurrentUser(event));
  if (!user) {
    const next = encodeURIComponent(event.url.pathname + event.url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (user.role !== role) {
    throw error(403, `This area is for ${role.replace('_', ' ')} accounts only.`);
  }
  return user;
}
