/**
 * Magic-link login. POSTs an email; we mint a token, persist its hash,
 * and mail the recipient a one-time sign-in link.
 *
 * Self-hosted flow:
 *   - issueAuthToken(email) — see $server/auth-tokens.ts
 *   - sendMagicLink(...)    — see $server/email.ts (SMTP via nodemailer)
 *   - GET /auth/callback?token=…  → consumeAuthToken(token), set JWT cookie
 *
 * Email enumeration: we look up the staff `users` row first. If it doesn't
 * exist we surface a friendly "ask an admin to invite you" message — no
 * tokens issued, no email sent.
 *
 * If a logged-in user hits /login, we send them straight to their role home.
 */

import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { z } from 'zod';
import { issueAuthToken } from '$server/auth-tokens.js';
import { getStaffUserByEmail } from '$server/auth.js';
import { sendMagicLink } from '$server/email.js';

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
  default: async ({ request, url, getClientAddress }) => {
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

    // Lookup the staff user before minting a token. We surface a clear
    // "not provisioned" message — the corresponding inbox of an attacker
    // who guesses unknown addresses still gets nothing from us.
    const staff = await getStaffUserByEmail(email);
    if (!staff) {
      return fail(404, {
        email,
        error: 'Email not found — ask an admin to invite you.'
      });
    }

    const ip = (() => {
      try { return getClientAddress(); } catch { return null; }
    })();
    const userAgent = request.headers.get('user-agent');

    let token: string;
    let expiresAt: string;
    try {
      const issued = await issueAuthToken(email, ip, userAgent);
      token = issued.token;
      expiresAt = issued.expiresAt;
    } catch (e) {
      console.error('[login] issueAuthToken failed:', e);
      return fail(500, {
        email,
        error: 'We couldn’t generate a sign-in link. Please try again.'
      });
    }

    const appOrigin = publicEnv.PUBLIC_APP_URL ?? url.origin;
    const next = (form.get('next') as string | null) ?? null;
    const sep = appOrigin.endsWith('/') ? '' : '';
    const signinUrl =
      `${appOrigin.replace(/\/$/, '')}/auth/callback?token=${encodeURIComponent(token)}` +
      (next ? `&next=${encodeURIComponent(next)}` : '');
    void sep;

    const mail = await sendMagicLink({
      to: email,
      fullName: staff.fullName,
      signinUrl,
      expiresAt
    });
    if (!mail.ok && mail.reason !== 'not_configured') {
      // Token's already in the DB; surface a friendly retry.
      console.warn('[login] sendMagicLink failed:', mail.reason);
      return fail(500, {
        email,
        error: 'We couldn’t send the sign-in link. Please try again.'
      });
    }

    return { success: true, email };
  }
};
