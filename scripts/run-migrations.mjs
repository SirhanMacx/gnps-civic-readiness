#!/usr/bin/env node
/**
 * Migration runner for the self-hosted Postgres instance.
 *
 * Reads supabase/migrations/*.sql in numerical order, tracks applied files in a
 * `_migrations` table (filename, applied_at, sha256), and applies any
 * unapplied migrations in order. Idempotent — re-running with no new
 * migrations is a no-op.
 *
 * Usage:
 *   DATABASE_URL=postgres://… node scripts/run-migrations.mjs
 *
 * Inside Docker compose this runs as a one-shot service (db-migrate) before
 * the app starts. The compose file mounts /migrations and /scripts.
 */

import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Aborting.');
  process.exit(1);
}

// In a Docker container the working dir is /scripts; the bind mount puts
// migrations at /migrations. In local dev it's <repo>/supabase/migrations.
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR
  ? process.env.MIGRATIONS_DIR
  : (() => {
      try {
        readdirSync('/migrations');
        return '/migrations';
      } catch {
        return new URL('../supabase/migrations', import.meta.url).pathname;
      }
    })();

const sql = postgres(DATABASE_URL, {
  ssl: process.env.PGSSL === 'true' ? 'require' : false,
  max: 1,
  onnotice: () => {} // suppress NOTICE noise
});

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

async function ensureLedger() {
  await sql`
    create table if not exists public._migrations (
      filename text primary key,
      sha256 text not null,
      applied_at timestamptz not null default now()
    )
  `;
}

async function applied() {
  const rows = await sql`select filename, sha256 from public._migrations`;
  return new Map(rows.map((r) => [r.filename, r.sha256]));
}

async function main() {
  console.log(`migrations dir: ${MIGRATIONS_DIR}`);
  await ensureLedger();
  const seen = await applied();

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const f of files) {
    const body = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    const hash = sha256(body);
    const prev = seen.get(f);
    if (prev) {
      if (prev !== hash) {
        console.error(
          `✗ migration ${f} was previously applied with a different content hash. ` +
            `Migrations are append-only; do not edit applied SQL files.`
        );
        process.exit(1);
      }
      continue;
    }
    process.stdout.write(`▸ applying ${f}…`);
    try {
      await sql.unsafe(body);
      await sql`insert into public._migrations (filename, sha256) values (${f}, ${hash})`;
      console.log(' ok');
      count++;
    } catch (e) {
      console.log(' FAILED');
      console.error(`  ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  }

  if (count === 0) {
    console.log('✓ no new migrations.');
  } else {
    console.log(`✓ applied ${count} migration(s).`);
  }
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
