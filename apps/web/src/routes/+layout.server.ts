/**
 * Root layout: surface the logged-in staff user (if any) to every page so
 * AppShell can render the "Hi, <name> · Logout" header bar.
 *
 * Anon users get user = null, which is fine — public routes (/, /submit, /login)
 * still render normally.
 */

import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals }) => {
  return { user: locals.user };
};
