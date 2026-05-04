/**
 * Request-scoped Supabase SSR client + staff-user lookup, attached to event.locals.
 *
 * Every request (anon or logged-in) gets event.locals.supabase and event.locals.user.
 * Anon users → user = null. Public routes (/, /submit, /login) work normally.
 * Protected routes use requireRole() inside +layout.server.ts to enforce auth.
 */

import type { Handle } from '@sveltejs/kit';
import { getCurrentUser, getSupabaseSsrClient } from '$server/auth.js';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = getSupabaseSsrClient(event);
  event.locals.user = await getCurrentUser(event);
  return resolve(event);
};
