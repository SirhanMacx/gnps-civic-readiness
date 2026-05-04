/**
 * Unit tests for the magic-link auth helpers in src/lib/server/auth.ts.
 *
 * We test requireRole's authorization branches by mocking the SvelteKit
 * RequestEvent (locals + cookies + url) and the Supabase admin client used
 * by getCurrentUser. We don't spin up a real Supabase project — these are
 * pure logic tests around the gate.
 */

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

// Mock the supabase admin module before importing auth.ts (vitest hoists vi.mock).
const adminBuilderState: { result: { data: any; error: any } } = {
  result: { data: null, error: null }
};

vi.mock('$server/supabase.js', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        ilike: () => ({
          maybeSingle: async () => adminBuilderState.result
        })
      })
    })
  })
}));

// Mock $env modules — they aren't available outside the SvelteKit dev server.
vi.mock('$env/dynamic/private', () => ({
  env: { SUPABASE_SERVICE_ROLE_KEY: 'srk-test', SUPABASE_ANON_KEY: 'anon-test' }
}));
vi.mock('$env/dynamic/public', () => ({
  env: {
    PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    PUBLIC_SUPABASE_ANON_KEY: 'anon-test',
    PUBLIC_APP_URL: 'http://localhost:5173'
  }
}));

// Mock @supabase/ssr so getSupabaseSsrClient can be called without a real network.
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null })
    }
  })
}));

// Import AFTER mocks are wired.
const { requireRole, getCurrentUser } = await import('../src/lib/server/auth.js');

interface MockUser {
  id: string;
  email: string;
  role: 'counselor' | 'scrc_member' | 'admin';
  fullName: string;
}

function fakeEvent(user: MockUser | null, pathname = '/counselor'): RequestEvent {
  // Minimum-viable fake — only the fields auth.ts reads. The supabase stub
  // mirrors what hooks.server.ts attaches in production.
  const supabaseStub = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null })
    }
  };
  return {
    locals: { user, supabase: supabaseStub as any },
    url: new URL(`http://localhost${pathname}`),
    cookies: {
      getAll: () => [],
      get: () => undefined,
      set: () => {},
      delete: () => {},
      serialize: () => ''
    } as any
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
    } catch (e: any) {
      expect(e.status).toBe(303);
      expect(e.location).toContain('next=');
      expect(e.location).toContain(encodeURIComponent('/admin/import'));
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

  it('returns null when there is no auth session', async () => {
    // The default @supabase/ssr mock returns user=null. So no DB lookup either.
    const event = fakeEvent(null);
    const result = await getCurrentUser(event);
    expect(result).toBeNull();
  });
});
