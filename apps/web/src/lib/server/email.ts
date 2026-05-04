import { Resend } from 'resend';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// Default dev-only secret. ANY production deploy MUST set SIGNED_LINK_SECRET in
// Vercel env vars; we log a loud warning every time we fall back.
const DEV_FALLBACK_SECRET = 'gnps-civic-dev-only-do-not-use-in-prod';
let warnedAboutMissingSecret = false;

function getSecret(): string {
  const secret = env.SIGNED_LINK_SECRET;
  if (secret && secret.length > 0) return secret;
  if (!warnedAboutMissingSecret) {
    console.warn(
      '[email] SIGNED_LINK_SECRET not set; using insecure dev fallback. ' +
        'Set this env var in Vercel before going live.'
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
  // Length must match before timingSafeEqual — that function throws if buffers
  // differ in length, which would itself leak info.
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return uuid;
  } catch {
    return null;
  }
}

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
  /** Reason the email could not be sent — e.g. 'not_configured', 'send_error'. */
  reason?: string;
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
        Great Neck Public Schools — Seal of Civic Readiness
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
 * Send the supervisor confirmation email. Gracefully degrades if RESEND_API_KEY
 * is not configured — Phase 1 must work even before the IT team adds Resend.
 * Failures NEVER throw; callers should not abort the submission flow if the
 * email fails to send. The hours_log row already exists; an admin can re-issue
 * the confirmation later from the queue.
 */
export async function sendSupervisorConfirmation(
  input: SupervisorEmailInput
): Promise<SupervisorEmailResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM ?? 'civicseal-gnps@resend.dev';
  const appUrl = publicEnv.PUBLIC_APP_URL ?? 'http://localhost:5173';

  const signed = signToken(input.confirmToken);
  const confirmUrl = `${appUrl.replace(/\/$/, '')}/confirm/${signed}`;
  const disputeUrl = `${confirmUrl}?dispute=1`;

  if (!apiKey) {
    console.warn('[email] Resend not configured; skipping supervisor confirmation email.');
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const resend = new Resend(apiKey);
    const subject = `Please confirm ${input.hours} service hours for ${input.studentName}`;
    const html = buildConfirmHtml(input, confirmUrl, disputeUrl);
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject,
      html
    });
    if (result.error) {
      console.warn('[email] Resend reported error:', result.error);
      return { ok: false, reason: 'send_error' };
    }
    return { ok: true, providerMessageId: result.data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[email] Resend send threw:', msg);
    return { ok: false, reason: 'send_error' };
  }
}
