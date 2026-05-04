/**
 * Server-side magic-link auth helpers for the GNPS Civic Readiness Portal.
 *
 * - getSupabaseSsrClient(event): per-request Supabase client backed by the auth cookie
 *   (uses @supabase/ssr). This is the client to use for auth operations
 *   (signInWithOtp / exchangeCodeForSession / signOut / getUser).
 * - getCurrentUser(event): reads the session from cookies, joins to the staff `users`
 *   table by email, returns the StaffUser or null.
 * - requireRole(event, role): redirects to /login if anonymous; throws 403 if logged
 *   in with a different role. Used inside +layout.server.ts gates.
 *
 * The existing supabaseAdmin() (service-role) client should still be used for
 * privileged data access — see ./supabase.ts.
 */

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { supabaseAdmin } from './supabase.js';
import type { StaffRole, StaffUser } from '../../app.d.ts';

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: true,
  maxAge: 60 * 60 * 24 * 7 // 7 days
};

/**
 * Build a Supabase SSR client that reads/writes the auth cookie from the
 * SvelteKit RequestEvent. Anon key is fine — RLS + the auth cookie protect data.
 */
export function getSupabaseSsrClient(event: RequestEvent): SupabaseClient {
  const url = publicEnv.PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY ?? privateEnv.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase env vars missing — set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY'
    );
  }
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () =>
        event.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          event.cookies.set(name, value, { ...COOKIE_OPTIONS, ...options, path: options?.path ?? '/' });
        }
      }
    }
  });
}

/**
 * Read the currently logged-in user from the auth cookie, then join to the
 * staff `users` table by email. Returns null if not logged in or if the
 * email doesn't match a `users` row (unprovisioned).
 *
 * Uses the SSR client to verify the JWT, then the admin client to read the
 * staff users table (RLS-locked from anon).
 */
export async function getCurrentUser(event: RequestEvent): Promise<StaffUser | null> {
  const supabase = event.locals.supabase ?? getSupabaseSsrClient(event);
  const {
    data: { user: authUser },
    error: authErr
  } = await supabase.auth.getUser();
  if (authErr || !authUser?.email) return null;

  const admin = supabaseAdmin();
  const { data, error: dbErr } = await admin
    .from('users')
    .select('id, email, role, full_name')
    .ilike('email', authUser.email)
    .maybeSingle();
  if (dbErr || !data) return null;

  return {
    id: data.id as string,
    email: data.email as string,
    role: data.role as StaffRole,
    fullName: (data.full_name as string) ?? authUser.email
  };
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
