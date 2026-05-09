/**
 * Stateless JWT session cookies — replaces the Supabase Auth cookie chain.
 *
 * Cookie name:    `civicseal_session`
 * Algorithm:      HS256
 * Secret:         env.SESSION_SECRET (required; refuse to start without it
 *                 unless we're in a non-production process — see signSession).
 * Expiry:         30 days. We re-issue on every successful magic-link login.
 *
 * Cookie attrs (production):
 *   httpOnly · secure · sameSite=lax · path=/ · maxAge=30d
 *
 * In dev (NODE_ENV !== 'production') we drop `secure` so the cookie sticks
 * on plain http://localhost.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

import type { StaffRole } from '../../app.d.ts';

const COOKIE_NAME = 'civicseal_session';
const ALG = 'HS256';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload extends JWTPayload {
  /** Internal `users.id` (uuid). */
  userId: string;
  /** Login email — also matches `users.email`. */
  email: string;
  /** Staff role gate the route layer enforces. */
  role: StaffRole;
}

const MIN_SECRET_LENGTH = 32;

let secretKeyCached: Uint8Array | null = null;

function getSecretKey(): Uint8Array {
  if (secretKeyCached) return secretKeyCached;
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'SESSION_SECRET is missing or too short — set a 32+ character random value.'
      );
    }
    console.warn(
      '[session] SESSION_SECRET missing or under 32 chars; using insecure dev fallback. ' +
        'Set this env var to a 32+ character random value before going live.'
    );
    secretKeyCached = new TextEncoder().encode(
      'dev-only-do-not-use-in-prod-' + Date.now().toString(36)
    );
    return secretKeyCached;
  }
  secretKeyCached = new TextEncoder().encode(secret);
  return secretKeyCached;
}

/**
 * Mint a 30-day session JWT for a staff user. Caller is responsible for
 * setting the cookie via setSessionCookie(...).
 */
export async function signSession(payload: {
  userId: string;
  email: string;
  role: StaffRole;
}): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verify a session JWT and return its payload. Returns null on any failure
 * (bad signature / expired / malformed) — never throws.
 */
export async function verifySession(jwt: string | undefined | null): Promise<SessionPayload | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, getSecretKey(), { algorithms: [ALG] });
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie on the SvelteKit `cookies` interface. Caller is
 * expected to issue a redirect afterward.
 */
export function setSessionCookie(cookies: Cookies, jwt: string): void {
  cookies.set(COOKIE_NAME, jwt, {
    path: '/',
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TTL_SECONDS
  });
}

/**
 * Read the session cookie value (for verification by the auth helpers).
 * Returns undefined when the cookie isn't present.
 */
export function readSessionCookie(cookies: Cookies): string | undefined {
  return cookies.get(COOKIE_NAME);
}

/** Tear down the session cookie — used on /logout. */
export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' });
}
