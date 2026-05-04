/**
 * Unit tests for the self-hosted auth helpers.
 *
 * Covers:
 *   - issueAuthToken / consumeAuthToken roundtrip + tamper / expiry rejection
 *   - signSession / verifySession roundtrip + tamper rejection
 *   - requireRole authorization branches (anon → 303, wrong role → 403,
 *     match → returns user)
 *
 * The Postgres facade and the `sql` tagged-template client are mocked so we
 * never hit a real DB. JWT signing uses the real `jose` library against an
 * in-test SESSION_SECRET.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

// ---------------------------------------------------------------------------
// In-memory fakes for the DB facade and the raw sql() client
// ---------------------------------------------------------------------------

interface AdminBuilderState {
  result: { data: unknown; error: unknown };
}
const adminBuilderState: AdminBuilderState = { result: { data: null, error: null } };

interface AuthTokenRow {
  email: string;
  token_hash: string;
  expires_at: number; // ms-since-epoch for easy fake-timers checks
  consumed_at: number | null;
}
const fakeAuthTokens: AuthTokenRow[] = [];

vi.mock('$server/supabase.js', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        ilike: () => ({
          maybeSingle: async () => adminBuilderState.result
        }),
        eq: () => ({
          maybeSingle: async () => adminBuilderState.result
        })
      })
    })
  })
}));

// Stub the postgres tagged-template client used by auth-tokens.ts. The
// auth-tokens helpers invoke `sql\`insert ...\`` and `sql\`with consumed as
// (update ...) returning email\``; we intercept by sniffing the SQL text and
// acting on the in-memory `fakeAuthTokens` array.
vi.mock('$server/db.js', () => {
  function tag(template: TemplateStringsArray, ...values: unknown[]): Promise<unknown> {
    const text = template.join('?').toLowerCase();
    // INSERT path (issueAuthToken).
    if (text.includes('insert into auth_tokens')) {
      const [email, tokenHash, expiresIso] = values as [string, string, string];
      fakeAuthTokens.push({
        email,
        token_hash: tokenHash,
        expires_at: new Date(expiresIso).getTime(),
        consumed_at: null
      });
      return Promise.resolve([]);
    }
    // CONSUME path (consumeAuthToken) — single-row CTE update.
    if (text.includes('update auth_tokens') && text.includes('returning email')) {
      const tokenHash = values[0] as string;
      const now = Date.now();
      const row = fakeAuthTokens.find(
        (r) => r.token_hash === tokenHash && r.consumed_at === null && r.expires_at > now
      );
      if (!row) return Promise.resolve([] as { email: string }[]);
      row.consumed_at = now;
      return Promise.resolve([{ email: row.email }] as { email: string }[]);
    }
    return Promise.resolve([]);
  }
  return {
    sql: tag,
    getSql: () => tag,
    db: { from: () => ({ select: () => ({}) }) }
  };
});

// $env modules — the real ones live in SvelteKit's runtime.
vi.mock('$env/dynamic/private', () => ({
  env: {
    SESSION_SECRET: 'test-secret-bytes-must-be-long-enough-for-hs256',
    DATABASE_URL: 'postgres://test',
    NODE_ENV: 'test'
  }
}));
vi.mock('$env/dynamic/public', () => ({
  env: { PUBLIC_APP_URL: 'http://localhost:5173' }
}));

// Imports AFTER mocks.
const { issueAuthToken, consumeAuthToken } = await import('../src/lib/server/auth-tokens.js');
const { signSession, verifySession } = await import('../src/lib/server/session.js');
const { requireRole, getCurrentUser } = await import('../src/lib/server/auth.js');

// ---------------------------------------------------------------------------
// Tests: auth-tokens
// ---------------------------------------------------------------------------

describe('issueAuthToken / consumeAuthToken', () => {
  beforeEach(() => {
    fakeAuthTokens.length = 0;
  });

  it('round-trips a token: issue → consume returns the original email', async () => {
    const { token } = await issueAuthToken('alice@greatneck.k12.ny.us');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(fakeAuthTokens).toHaveLength(1);
    expect(fakeAuthTokens[0]?.token_hash).not.toBe(token); // stored as hash, not raw
    const email = await consumeAuthToken(token);
    expect(email).toBe('alice@greatneck.k12.ny.us');
  });

  it('returns null for an unknown token', async () => {
    const email = await consumeAuthToken('deadbeef'.repeat(8));
    expect(email).toBeNull();
  });

  it('rejects a token after it has been consumed (single-use)', async () => {
    const { token } = await issueAuthToken('bob@greatneck.k12.ny.us');
    expect(await consumeAuthToken(token)).toBe('bob@greatneck.k12.ny.us');
    expect(await consumeAuthToken(token)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const { token } = await issueAuthToken('carol@greatneck.k12.ny.us');
    // Simulate expiry by rewinding the row.
    fakeAuthTokens[0]!.expires_at = Date.now() - 1000;
    expect(await consumeAuthToken(token)).toBeNull();
  });

  it('rejects empty / non-string tokens', async () => {
    expect(await consumeAuthToken('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: session JWT
// ---------------------------------------------------------------------------

describe('signSession / verifySession', () => {
  it('round-trips userId/email/role', async () => {
    const jwt = await signSession({
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'a@greatneck.k12.ny.us',
      role: 'counselor'
    });
    const payload = await verifySession(jwt);
    expect(payload?.userId).toBe('00000000-0000-0000-0000-000000000001');
    expect(payload?.email).toBe('a@greatneck.k12.ny.us');
    expect(payload?.role).toBe('counselor');
  });

  it('rejects a tampered JWT', async () => {
    const jwt = await signSession({
      userId: '00000000-0000-0000-0000-000000000002',
      email: 'b@greatneck.k12.ny.us',
      role: 'admin'
    });
    const flipped = jwt.slice(0, -2) + (jwt.slice(-2) === 'aa' ? 'bb' : 'aa');
    expect(await verifySession(flipped)).toBeNull();
  });

  it('rejects null/empty inputs without throwing', async () => {
    expect(await verifySession(null)).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession('')).toBeNull();
    expect(await verifySession('not-a-jwt')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: requireRole (gate)
// ---------------------------------------------------------------------------

interface MockUser {
  id: string;
  email: string;
  role: 'counselor' | 'scrc_member' | 'admin';
  fullName: string;
}

function fakeEvent(user: MockUser | null, pathname = '/counselor'): RequestEvent {
  return {
    locals: { user },
    url: new URL(`http://localhost${pathname}`),
    cookies: {
      getAll: () => [],
      get: () => undefined,
      set: () => {},
      delete: () => {},
      serialize: () => ''
    } as never
  } as unknown as RequestEvent;
}

describe('requireRole', () => {
  beforeEach(() => {
    adminBuilderState.result = { data: null, error: null };
  });

  it('returns the user when role matches', async () => {
    const user: MockUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'c@greatneck.k12.ny.us',
      role: 'counselor',
      fullName: 'Carla Counselor'
    };
    const result = await requireRole(fakeEvent(user), 'counselor');
    expect(result).toEqual(user);
  });

  it('returns the user when role matches for scrc_member', async () => {
    const user: MockUser = {
      id: '00000000-0000-0000-0000-000000000002',
      email: 's@greatneck.k12.ny.us',
      role: 'scrc_member',
      fullName: 'Sam SCRC'
    };
    const result = await requireRole(fakeEvent(user, '/scrc'), 'scrc_member');
    expect(result.role).toBe('scrc_member');
  });

  it('redirects (303 to /login) when no user is logged in', async () => {
    await expect(requireRole(fakeEvent(null), 'counselor')).rejects.toMatchObject({
      status: 303,
      location: expect.stringContaining('/login')
    });
  });

  it('preserves the original path in ?next= after redirect', async () => {
    try {
      await requireRole(fakeEvent(null, '/admin/import?cohort=2027'), 'admin');
      throw new Error('should have thrown a redirect');
    } catch (e: unknown) {
      const r = e as { status: number; location: string };
      expect(r.status).toBe(303);
      expect(r.location).toContain('next=');
      expect(r.location).toContain(encodeURIComponent('/admin/import'));
    }
  });

  it('throws 403 when logged in but with the wrong role (counselor on /admin)', async () => {
    const user: MockUser = {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'c@greatneck.k12.ny.us',
      role: 'counselor',
      fullName: 'Carla Counselor'
    };
    await expect(requireRole(fakeEvent(user, '/admin'), 'admin')).rejects.toMatchObject({
      status: 403
    });
  });

  it('throws 403 when scrc_member tries to enter counselor area', async () => {
    const user: MockUser = {
      id: '00000000-0000-0000-0000-000000000004',
      email: 's@greatneck.k12.ny.us',
      role: 'scrc_member',
      fullName: 'Sam SCRC'
    };
    await expect(
      requireRole(fakeEvent(user, '/counselor'), 'counselor')
    ).rejects.toMatchObject({ status: 403 });
  });

  it('throws 403 when admin tries to enter scrc area (no role bleed-through)', async () => {
    const user: MockUser = {
      id: '00000000-0000-0000-0000-000000000005',
      email: 'a@greatneck.k12.ny.us',
      role: 'admin',
      fullName: 'Anna Admin'
    };
    await expect(requireRole(fakeEvent(user, '/scrc'), 'scrc_member')).rejects.toMatchObject({
      status: 403
    });
  });
});

describe('getCurrentUser', () => {
  afterEach(() => {
    adminBuilderState.result = { data: null, error: null };
  });

  it('returns null when there is no session cookie', async () => {
    const result = await getCurrentUser(fakeEvent(null));
    expect(result).toBeNull();
  });
});
