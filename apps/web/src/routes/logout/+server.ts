/**
 * Sign out and bounce home. Accepts POST (preferred, CSRF-safer via SvelteKit form)
 * and GET (so a plain link can log out — used by AppShell).
 */

import { redirect, type RequestHandler } from '@sveltejs/kit';

const handler: RequestHandler = async ({ locals }) => {
  await locals.supabase.auth.signOut();
  throw redirect(303, '/');
};

export const POST = handler;
export const GET = handler;
