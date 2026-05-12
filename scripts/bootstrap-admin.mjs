#!/usr/bin/env node
/**
 * Provision the first admin account for the self-hosted stack.
 *
 * This intentionally uses postgres.js tagged-template parameters instead of
 * psql string interpolation so `make admin EMAIL=...` never injects raw user
 * input into SQL text.
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Aborting.');
  process.exit(1);
}

const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('ADMIN_EMAIL must be a valid email address.');
  process.exit(1);
}

const PGSSL = (process.env.PGSSL ?? 'false').toLowerCase();
if (PGSSL !== 'true' && PGSSL !== 'false') {
  console.error('PGSSL must be either "true" or "false".');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  ssl: PGSSL === 'true' ? 'require' : false,
  max: 1,
  onnotice: () => undefined
});

try {
  await sql`
    insert into public.users (email, full_name, role)
    values (${email}, ${email}, 'admin')
    on conflict (email) do update
      set role = 'admin'
  `;
  await sql.end({ timeout: 5 });
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  await sql.end({ timeout: 5 }).catch(() => undefined);
  process.exit(1);
}
