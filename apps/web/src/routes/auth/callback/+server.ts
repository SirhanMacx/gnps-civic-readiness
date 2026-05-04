/**
 * Magic-link callback. Supabase redirects here after the user clicks the
 * email link. We exchange the OAuth code for a session, then route to the
 * role home (/admin, /scrc, /counselor).
 *
 * If the email isn't in the `users` table, we sign out and bounce to
 * /login?error=no_role — admins must invite staff explicitly (no auto-create).
 */

import { redirect, type RequestHandler } from '@sveltejs/kit';
import { supabaseAdmin } from '$server/supabase.js';

function homeFor(role: string | null | undefined): string {
  if (role === 'admin') return '/admin';
  if (role === 'scrc_member') return '/scrc';
  if (role === 'counselor') return '/counselor';
  return '/login?error=no_role';
}

export const GET: RequestHandler = async ({ url, locals }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  const errorCode = url.searchParams.get('error_code') ?? url.searchParams.get('error');

  if (errorCode) {
    const code = errorCode === 'otp_expired' || errorCode.includes('expired') ? 'expired' : 'invalid_link';
    throw redirect(303, `/login?error=${code}`);
  }

  if (!code) {
    throw redirect(303, '/login?error=invalid_link');
  }

  const { data, error: exchangeErr } = await locals.supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr || !data.user?.email) {
    throw redirect(303, '/login?error=invalid_link');
  }

  // Look up the staff user by email. No auto-create — admins invite explicitly.
  const admin = supabaseAdmin();
  const { data: staffRow } = await admin
    .from('users')
    .select('role')
    .ilike('email', data.user.email)
    .maybeSingle();

  if (!staffRow) {
    // Authenticated but unprovisioned — sign them out so the cookie doesn't linger.
    await locals.supabase.auth.signOut();
    throw redirect(303, '/login?error=no_role');
  }

  // Sanitize next: only allow internal absolute paths
  const safeNext =
    next && /^\/[A-Za-z0-9_\-/.?=&%]*$/.test(next) && !next.startsWith('//')
      ? next
      : null;

  throw redirect(303, safeNext ?? homeFor(staffRow.role as string));
};
