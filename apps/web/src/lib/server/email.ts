/**
 * SMTP-based email sender for the GNPS Civic Readiness Portal.
 *
 * The transport is created lazily on the first send and cached for the
 * process lifetime. If SMTP_HOST isn't set, every helper short-circuits to
 * `{ ok: false, reason: 'not_configured' }` · Phase-1 deployments without
 * an SMTP relay still work end-to-end (sends are skipped with a console
 * warning, hours_log / tokens are still persisted).
 *
 * Public functions:
 *   - signToken / verifyToken             · HMAC-SHA-256 of a UUID for the
 *                                            supervisor confirmation links and
 *                                            evidence signed-URLs.
 *   - sendSupervisorConfirmation(input)   · branded confirmation email.
 *   - sendMagicLink({ to, ... })          · staff sign-in link (1-hour expiry).
 *   - sendEmail({ to, subject, html, ... }) · generic relay used by the
 *                                            student progress report and any
 *                                            future ad-hoc senders.
 *
 * No external SaaS dependency.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// ---------------------------------------------------------------------------
// HMAC token helpers (UUID-keyed signed URLs)
// ---------------------------------------------------------------------------

const DEV_FALLBACK_SECRET = 'gnps-civic-dev-only-do-not-use-in-prod';
let warnedAboutMissingSecret = false;

function getSecret(): string {
  const secret = env.SIGNED_LINK_SECRET;
  if (secret && secret.length > 0) return secret;
  if (!warnedAboutMissingSecret) {
    console.warn(
      '[email] SIGNED_LINK_SECRET not set; using insecure dev fallback. ' +
        'Set this env var before going live.'
    );
    warnedAboutMissingSecret = true;
  }
  return DEV_FALLBACK_SECRET;
}

/**
 * Sign a UUID into a URL-safe token of the form "<uuid>.<32-char hex sig>".
 * The signature is HMAC-SHA256 over the UUID using SIGNED_LINK_SECRET, truncated
 * to 16 bytes (32 hex chars). 16 bytes of MAC is more than enough for a
 * non-secret-bearing identifier whose only purpose is unforgeability.
 */
export function signToken(uuid: string): string {
  const sig = createHmac('sha256', getSecret()).update(uuid).digest('hex').slice(0, 32);
  return `${uuid}.${sig}`;
}

/**
 * Verify a token previously produced by signToken. Returns the UUID payload on
 * success, null otherwise. Uses constant-time comparison so attackers cannot
 * use signature-validation timing as a side channel.
 */
export function verifyToken(token: string): string | null {
  if (typeof token !== 'string' || token.length === 0) return null;
  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0 || dotIndex === token.length - 1) return null;
  const uuid = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  if (!uuid || !sig) return null;
  const expected = createHmac('sha256', getSecret()).update(uuid).digest('hex').slice(0, 32);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return uuid;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SMTP transport
// ---------------------------------------------------------------------------

let cachedTransporter: Transporter | null = null;

interface SmtpConfig {
  host: string;
  port: number;
  user: string | undefined;
  pass: string | undefined;
  secure: boolean;
  from: string;
}

function readSmtpConfig(): SmtpConfig | null {
  const host = env.SMTP_HOST;
  if (!host) return null;
  const portRaw = env.SMTP_PORT;
  const port = portRaw ? Number(portRaw) : 587;
  const secure = (env.SMTP_SECURE ?? 'false').toLowerCase() === 'true';
  return {
    host,
    port,
    user: env.SMTP_USER || undefined,
    pass: env.SMTP_PASS || undefined,
    secure,
    from: env.EMAIL_FROM ?? 'GNPS Civic Readiness <civicseal@greatneck.k12.ny.us>'
  };
}

function getTransport(cfg: SmtpConfig): Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined
  });
  return cachedTransporter;
}

// ---------------------------------------------------------------------------
// Generic send
// ---------------------------------------------------------------------------

export interface SendEmailInput {
  to: string;
  /** Optional CC list · used to copy the student's faculty advisor on progress reports. */
  cc?: string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** Provider-side message id when available. */
  messageId?: string;
  /** Reason the email was not sent · 'not_configured' | 'send_error'. */
  reason?: 'not_configured' | 'send_error';
}

/**
 * Send a generic transactional email. Used by the student progress report
 * and any future one-off senders. Failures NEVER throw · caller can decide
 * whether to surface the warning or log it.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const cfg = readSmtpConfig();
  if (!cfg) {
    console.warn('[email] SMTP not configured; skipping send to', input.to);
    return { ok: false, reason: 'not_configured' };
  }
  try {
    const transporter = getTransport(cfg);
    const info = await transporter.sendMail({
      from: cfg.from,
      to: input.to,
      cc: input.cc && input.cc.length > 0 ? input.cc : undefined,
      subject: input.subject,
      html: input.html,
      text: input.text
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    console.warn('[email] send failed:', e);
    return { ok: false, reason: 'send_error' };
  }
}

// ---------------------------------------------------------------------------
// Magic-link email
// ---------------------------------------------------------------------------

export interface MagicLinkEmailInput {
  to: string;
  fullName: string;
  signinUrl: string;
  /** ISO timestamp when the link stops working · surfaced in the body. */
  expiresAt: string;
}

function buildMagicLinkHtml(i: MagicLinkEmailInput): string {
  const safeName = i.fullName.replace(/</g, '&lt;');
  const expires = new Date(i.expiresAt);
  const expiresLocal = isNaN(expires.getTime())
    ? '1 hour from now'
    : expires.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        timeZoneName: 'short'
      });
  return `<!doctype html>
<html>
<body style="margin:0;padding:24px;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;background:#f7f9fc">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d4d8e0;border-radius:8px;overflow:hidden">
    <tr>
      <td style="background:#204A97;color:#fff;padding:18px 24px;font-weight:600;font-size:15px">
        Great Neck Public Schools · Seal of Civic Readiness
      </td>
    </tr>
    <tr>
      <td style="padding:24px">
        <p style="margin:0 0 12px 0;font-size:15px">Hi ${safeName},</p>
        <p style="margin:0 0 18px 0;font-size:15px;line-height:1.5">Click the button below to sign in to the Civic Readiness Portal. This link expires <strong>${expiresLocal}</strong> and can be used once.</p>
        <p style="margin:0 0 24px 0">
          <a href="${i.signinUrl}" style="background:#FE8158;color:#ffffff;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:600;display:inline-block">Sign in</a>
        </p>
        <p style="margin:0;font-size:12px;color:#555;line-height:1.5">
          If you didn't request this, you can ignore this email. The link will expire on its own. Questions? Email <a href="mailto:civicseal@greatneck.k12.ny.us" style="color:#204A97">civicseal@greatneck.k12.ny.us</a>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f7f9fc;border-top:1px solid #d4d8e0;padding:14px 24px;font-size:11px;color:#555">
        Sent by the GNPS Civic Readiness Portal.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Mail a one-time sign-in link to a staff member. The token in the URL is
 * already burnable (see auth-tokens.ts); this helper just delivers it.
 */
export async function sendMagicLink(input: MagicLinkEmailInput): Promise<SendEmailResult> {
  return sendEmail({
    to: input.to,
    subject: 'Sign in to the GNPS Civic Readiness Portal',
    html: buildMagicLinkHtml(input),
    text:
      `Hi ${input.fullName},\n\n` +
      `Click the link to sign in: ${input.signinUrl}\n\n` +
      `Link expires at ${input.expiresAt} and can be used once.\n\n` +
      `If you didn't request this, you can ignore this email.\n`
  });
}

// ---------------------------------------------------------------------------
// Supervisor confirmation email
// ---------------------------------------------------------------------------

export interface SupervisorEmailInput {
  to: string;
  supervisorName: string;
  studentName: string;
  studentSchool: string;
  hours: number;
  organization: string;
  dateRange: string;
  /** Raw confirmation_token UUID from hours_log; we sign it before embedding in the URL. */
  confirmToken: string;
}

export interface SupervisorEmailResult {
  ok: boolean;
  providerMessageId?: string;
  /** Reason the email could not be sent · e.g. 'not_configured', 'send_error'. */
  reason?: 'not_configured' | 'send_error';
}

function buildConfirmHtml(i: SupervisorEmailInput, confirmUrl: string, disputeUrl: string): string {
  // Inline-styled HTML so it renders in Outlook / Gmail / mobile clients without
  // a stylesheet dependency. Colors come from the GNPS theme tokens (#204A97
  // primary, #FE8158 secondary).
  const greeting = `Hi ${i.supervisorName},`;
  const intro = `${i.studentName}, a student at ${i.studentSchool}, is pursuing the New York State Seal of Civic Readiness. They listed you as their supervisor for <strong>${i.hours} hours</strong> at <strong>${i.organization}</strong> on ${i.dateRange}.`;

  return `<!doctype html>
<html>
<body style="margin:0;padding:24px;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;background:#f7f9fc">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d4d8e0;border-radius:8px;overflow:hidden">
    <tr>
      <td style="background:#204A97;color:#fff;padding:18px 24px;font-weight:600;font-size:15px">
        Great Neck Public Schools · Seal of Civic Readiness
      </td>
    </tr>
    <tr>
      <td style="padding:24px">
        <p style="margin:0 0 12px 0;font-size:15px">${greeting}</p>
        <p style="margin:0 0 18px 0;font-size:15px;line-height:1.5">${intro}</p>
        <p style="margin:0 0 24px 0;font-size:15px">Could you take 5 seconds to confirm these hours?</p>
        <p style="margin:0 0 12px 0">
          <a href="${confirmUrl}" style="background:#FE8158;color:#ffffff;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:600;display:inline-block">Confirm ${i.hours} hours</a>
        </p>
        <p style="margin:0 0 24px 0">
          <a href="${disputeUrl}" style="color:#204A97;text-decoration:underline;font-size:14px">Hours don&rsquo;t match? Tell us</a>
        </p>
        <p style="margin:0;font-size:12px;color:#555;line-height:1.5">
          This link expires in 14 days. If you didn&rsquo;t supervise this student, you can ignore this email. Questions: <a href="mailto:civicseal@greatneck.k12.ny.us" style="color:#204A97">civicseal@greatneck.k12.ny.us</a>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f7f9fc;border-top:1px solid #d4d8e0;padding:14px 24px;font-size:11px;color:#555">
        Sent by the GNPS Civic Readiness Portal on behalf of Great Neck Public Schools.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send the supervisor confirmation email. Gracefully degrades if SMTP_HOST
 * is not configured. Failures NEVER throw; callers should not abort the
 * submission flow if the email fails to send. The hours_log row already
 * exists; an admin can re-issue the confirmation later from the queue.
 */
export async function sendSupervisorConfirmation(
  input: SupervisorEmailInput
): Promise<SupervisorEmailResult> {
  const appUrl = publicEnv.PUBLIC_APP_URL ?? 'http://localhost:5173';
  const signed = signToken(input.confirmToken);
  const confirmUrl = `${appUrl.replace(/\/$/, '')}/confirm/${signed}`;
  const disputeUrl = `${confirmUrl}?dispute=1`;

  const subject = `Please confirm ${input.hours} service hours for ${input.studentName}`;
  const html = buildConfirmHtml(input, confirmUrl, disputeUrl);

  const result = await sendEmail({
    to: input.to,
    subject,
    html
  });
  if (!result.ok) {
    return { ok: false, reason: result.reason ?? 'send_error' };
  }
  return { ok: true, providerMessageId: result.messageId };
}
