/**
 * Per-request staff-user resolution + locals attachment.
 *
 * Reads the session cookie (`civicseal_session`), verifies the JWT, looks up
 * the matching `public.users` row, and stashes the StaffUser (or null) on
 * `event.locals.user`. Public routes (/, /submit, /login, /confirm/[token])
 * see `null`; protected routes use `requireRole()` inside +layout.server.ts
 * to enforce the role gate.
 */

import type { Handle } from '@sveltejs/kit';
import { getCurrentUser } from '$server/auth.js';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = await getCurrentUser(event);
  return resolve(event);
};
