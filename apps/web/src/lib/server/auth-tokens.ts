/**
 * Magic-link token issue / consume helpers for the self-hosted login flow.
 *
 * Schema:                                 supabase/migrations/0008_auth_tokens.sql
 * Email transport:                        $server/email.ts → sendMagicLink()
 * Login form action:                      src/routes/login/+page.server.ts
 * Callback (consumes the token):          src/routes/auth/callback/+server.ts
 *
 * Lifecycle:
 *   1. issueAuthToken(email)
 *        → 32 random bytes hex-encoded → that's the token mailed to the user.
 *        → DB stores SHA-256(token) so a leaked row doesn't reveal a usable token.
 *        → expires_at = now() + 1 hour.
 *   2. consumeAuthToken(token)
 *        → SHA-256 the input, look up the row, verify not consumed and not
 *          expired, then mark consumed_at and return the email.
 *
 * Returns null on any verification failure — the caller's job to translate
 * that to a 303 to /login?error=invalid_or_expired without leaking which
 * branch failed.
 */

import { createHash, randomBytes } from 'node:crypto';
import { sql } from './db.js';

const TOKEN_BYTES = 32; // 256 bits → 64-char hex string
const TTL_MINUTES = 60; // 1-hour magic links

export interface IssueResult {
  /** The opaque token to embed in the URL — the recipient mails this back. */
  token: string;
  /** ISO timestamp when the token stops being valid. */
  expiresAt: string;
}

/**
 * Mint a fresh magic-link token for `email`. The raw token is only ever
 * returned by this call; the DB stores its hash. Caller is expected to mail
 * the token via the SMTP sender within the 1-hour window.
 *
 * @param email      Recipient's email — case-preservation is the caller's
 *                   responsibility (we recommend normalizing to lowercase).
 * @param ip         Client IP for the audit row (optional; null in tests).
 * @param userAgent  Client UA string for the audit row (optional).
 */
export async function issueAuthToken(
  email: string,
  ip?: string | null,
  userAgent?: string | null
): Promise<IssueResult> {
  const token = randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = sha256Hex(token);
  const expires = new Date(Date.now() + TTL_MINUTES * 60_000);
  await sql()`
    insert into auth_tokens (email, token_hash, expires_at, ip, user_agent)
    values (${email}, ${tokenHash}, ${expires.toISOString()}::timestamptz, ${ip ?? null}, ${userAgent ?? null})
  `;
  return { token, expiresAt: expires.toISOString() };
}

/**
 * Verify and burn a magic-link token. Returns the email it was issued for,
 * or null if the token is unknown / expired / already consumed.
 *
 * Security: we mark `consumed_at` in the same UPDATE that asserts the row
 * is still pending — a single-row CTE prevents a race where two simultaneous
 * clicks both succeed.
 */
export async function consumeAuthToken(token: string): Promise<string | null> {
  if (typeof token !== 'string' || token.length === 0) return null;
  const tokenHash = sha256Hex(token);
  const rows = (await sql()<{ email: string }[]>`
    with consumed as (
      update auth_tokens
      set consumed_at = now()
      where token_hash = ${tokenHash}
        and consumed_at is null
        and expires_at > now()
      returning email
    )
    select email from consumed
  `) as unknown as { email: string }[];
  if (rows.length === 0) return null;
  return rows[0]!.email;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
