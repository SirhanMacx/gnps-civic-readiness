#!/usr/bin/env node
/**
 * Sync the workspace packages (`packages/pathway-rules`, `packages/nysed-export`)
 * into `apps/web/src/lib/` so the SvelteKit build can resolve them locally
 * without depending on workspace:* deps that Vercel's npm-install can't follow.
 *
 * Run as a `prebuild` and from CI to ensure the vendored copies stay in sync.
 *
 * If the sync produces a diff, this exits with code 0 (vendored files updated).
 * If everything was already in sync, it exits with code 0 silently.
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const PAIRS = [
  { from: 'packages/pathway-rules/src', to: 'apps/web/src/lib/pathway-rules' },
  { from: 'packages/nysed-export/src', to: 'apps/web/src/lib/nysed-export' }
];

let changed = 0;

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) entries.push(...walk(p));
    else entries.push(p);
  }
  return entries;
}

for (const { from, to } of PAIRS) {
  const fromAbs = join(REPO_ROOT, from);
  const toAbs = join(REPO_ROOT, to);
  mkdirSync(toAbs, { recursive: true });
  for (const fileAbs of walk(fromAbs)) {
    const rel = relative(fromAbs, fileAbs);
    const dest = join(toAbs, rel);
    mkdirSync(dirname(dest), { recursive: true });
    const src = readFileSync(fileAbs, 'utf8');
    let dst = '';
    try {
      dst = readFileSync(dest, 'utf8');
    } catch {
      /* dest doesn't exist yet */
    }
    if (src !== dst) {
      writeFileSync(dest, src);
      changed++;
      console.log(`  synced  ${relative(REPO_ROOT, dest)}`);
    }
  }
}

if (changed === 0) {
  console.log('vendored packages already in sync.');
} else {
  console.log(`✓ synced ${changed} file(s).`);
}
