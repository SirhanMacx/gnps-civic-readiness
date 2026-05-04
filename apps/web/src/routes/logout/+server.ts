/**
 * Sign out and bounce home. Accepts POST (preferred, CSRF-safer via SvelteKit form)
 * and GET (so a plain link can log out — used by AppShell).
 */

import { redirect, type RequestHandler } from '@sveltejs/kit';
import { clearSessionCookie } from '$server/session.js';

const handler: RequestHandler = async ({ cookies }) => {
  clearSessionCookie(cookies);
  throw redirect(303, '/');
};

export const POST = handler;
export const GET = handler;
