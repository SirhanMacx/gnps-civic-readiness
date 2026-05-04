/**
 * Magic-link callback. The mailed link points here with `?token=…`.
 *
 *   1. consumeAuthToken(token) — verifies, marks consumed, returns email
 *   2. getStaffUserByEmail(email) — locates the staff row
 *   3. signSession(...) — mints a 30-day JWT
 *   4. setSessionCookie + redirect to ?next or role-home
 *
 * Failure paths:
 *   - missing token         → /login?error=invalid_link
 *   - expired/consumed token → /login?error=invalid_or_expired
 *   - email not in users    → /login?error=no_role
 */

import { redirect, type RequestHandler } from '@sveltejs/kit';
import { consumeAuthToken } from '$server/auth-tokens.js';
import { getStaffUserByEmail } from '$server/auth.js';
import { signSession, setSessionCookie } from '$server/session.js';

function homeFor(role: string | null | undefined): string {
  if (role === 'admin') return '/admin';
  if (role === 'scrc_member') return '/scrc';
  if (role === 'counselor') return '/counselor';
  return '/login?error=no_role';
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = url.searchParams.get('token');
  const next = url.searchParams.get('next');

  if (!token) {
    throw redirect(303, '/login?error=invalid_link');
  }

  const email = await consumeAuthToken(token);
  if (!email) {
    throw redirect(303, '/login?error=invalid_or_expired');
  }

  const staff = await getStaffUserByEmail(email);
  if (!staff) {
    throw redirect(303, '/login?error=no_role');
  }

  const jwt = await signSession({
    userId: staff.id,
    email: staff.email,
    role: staff.role
  });
  setSessionCookie(cookies, jwt);

  // Sanitize next: only allow internal absolute paths.
  const safeNext =
    next && /^\/[A-Za-z0-9_\-/.?=&%]*$/.test(next) && !next.startsWith('//')
      ? next
      : null;

  throw redirect(303, safeNext ?? homeFor(staff.role));
};
