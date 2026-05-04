/**
 * Magic-link login action. POSTs an email; Supabase Auth mails a one-time
 * sign-in link with a redirect back to /auth/callback.
 *
 * Phase 1 uses Supabase's default email infra (sender: noreply@mail.app.supabase.io).
 * Phase 2 will route through district email per IT-handoff brief item #6.
 *
 * If a logged-in user hits /login, we send them straight to their role home.
 */

import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { z } from 'zod';

const EmailSchema = z.string().trim().toLowerCase().email().max(200);

function homeFor(role: string | null | undefined): string | null {
  if (role === 'admin') return '/admin';
  if (role === 'scrc_member') return '/scrc';
  if (role === 'counselor') return '/counselor';
  return null;
}

export const load: ServerLoad = async ({ locals, url }) => {
  if (locals.user) {
    const home = homeFor(locals.user.role);
    if (home) throw redirect(303, home);
  }
  return {
    error: url.searchParams.get('error'),
    next: url.searchParams.get('next') ?? null
  };
};

export const actions: Actions = {
  default: async ({ request, locals, url }) => {
    const form = await request.formData();
    const rawEmail = form.get('email');
    if (typeof rawEmail !== 'string') {
      return fail(400, { error: 'Please enter an email address.' });
    }

    const parsed = EmailSchema.safeParse(rawEmail);
    if (!parsed.success) {
      return fail(400, {
        email: rawEmail,
        error: 'That doesn’t look like a valid email address.'
      });
    }
    const email = parsed.data;

    // The magic link redirects back through /auth/callback, which in turn
    // routes to /counselor, /scrc, or /admin based on the matched users.role.
    const appOrigin = publicEnv.PUBLIC_APP_URL ?? url.origin;
    const next = (form.get('next') as string | null) ?? null;
    const redirectTo = `${appOrigin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;

    const { error: authErr } = await locals.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false
      }
    });

    if (authErr) {
      const msg = authErr.message?.toLowerCase() ?? '';
      // Don't leak whether an email is in users — surface a generic friendly note.
      // But surface real rate-limit / signup errors so users know to wait or contact admin.
      if (msg.includes('rate') || msg.includes('too many')) {
        return fail(429, {
          email,
          error: 'Too many sign-in attempts. Please wait a minute and try again.'
        });
      }
      if (msg.includes('signups not allowed') || msg.includes('user not found')) {
        // shouldCreateUser=false means a not-yet-invited address gets this — show success
        // anyway to avoid email enumeration; admin will notice if they're locked out.
        return { success: true, email };
      }
      return fail(500, {
        email,
        error: 'We couldn’t send the sign-in link. Please try again.'
      });
    }

    return { success: true, email };
  }
};
