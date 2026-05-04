/**
 * `supabaseAdmin()` is a backwards-compatibility shim that delegates to the
 * direct-Postgres facade in `./db.ts`. Existing call sites use the
 * `sb.from(...)` chain; we expose the same surface so they keep compiling
 * while we migrate off Supabase as a SaaS dependency.
 *
 * Storage and Auth are NOT exposed here — those have been replaced by:
 *   - $server/storage.ts  (filesystem / S3 backend)
 *   - $server/auth.ts     (self-hosted JWT sessions)
 *
 * New code should import `db` directly from `./db.js` rather than calling
 * `supabaseAdmin()`. This shim exists only to avoid sprawling diffs in the
 * SCRC / counselor / admin route handlers during the Supabase-removal pass.
 */

import { db, type DbTableQuery } from './db.js';

export interface SupabaseAdminLike {
  from(table: string): DbTableQuery;
}

/**
 * Returns the Postgres-backed query facade. The name is preserved so legacy
 * call sites that destructure `const sb = supabaseAdmin();` continue to work.
 */
export function supabaseAdmin(): SupabaseAdminLike {
  return db;
}
