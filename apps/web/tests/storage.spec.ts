/**
 * Tests for the filesystem-backed evidence storage backend + HMAC-signed
 * URL helper. Covers:
 *
 *   - upload + download roundtrip
 *   - signedUrl produces a token whose payload verifies
 *   - signed token expires after its TTL (vi.useFakeTimers)
 *   - keys with `..` segments are rejected before any disk IO
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

vi.mock('$env/dynamic/private', () => ({
  env: {
    STORAGE_BACKEND: 'fs',
    EVIDENCE_DIR: '', // overridden in beforeEach
    SIGNED_LINK_SECRET: 'unit-test-secret-do-not-use-in-prod-1234'
  }
}));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

let envMod: typeof import('$env/dynamic/private') & { env: Record<string, string> };

const mod = await import('../src/lib/server/storage.js');
const { getStorage, sanitizeKey, signEvidenceToken, verifyEvidenceToken, _resetStorageForTests } = mod;

let tmpRoot: string;

beforeEach(async () => {
  // Each test gets a clean tmp dir.
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'civic-storage-'));
  envMod = await import('$env/dynamic/private') as never;
  envMod.env.EVIDENCE_DIR = tmpRoot;
  _resetStorageForTests();
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('FsBackend upload + download', () => {
  it('round-trips bytes', async () => {
    const storage = getStorage();
    const key = 'civic_elective/GN20271234/42-essay.pdf';
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
    const stored = await storage.upload(key, bytes, 'application/pdf');
    expect(stored.storagePath).toBe(key);
    expect(stored.size).toBe(bytes.byteLength);

    // File ended up under the configured root.
    const onDisk = await fs.readFile(path.join(tmpRoot, key));
    expect(new Uint8Array(onDisk)).toEqual(bytes);

    // download returns identical bytes.
    const dl = await storage.download(key);
    expect(dl).toEqual(bytes);
  });
});

describe('FsBackend signedUrl', () => {
  it('produces a /api/evidence/<token> URL whose token verifies', async () => {
    const storage = getStorage();
    const key = 'civic_elective/GN20271234/42-essay.pdf';
    const url = await storage.signedUrl(key, 60);
    expect(url).toMatch(/^\/api\/evidence\//);
    const token = decodeURIComponent(url.replace(/^\/api\/evidence\//, ''));
    const verified = verifyEvidenceToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.key).toBe(key);
  });

  it('expires after the TTL', async () => {
    vi.useFakeTimers();
    try {
      const t0 = new Date('2026-05-04T12:00:00Z').getTime();
      vi.setSystemTime(t0);
      const token = signEvidenceToken('civic_elective/GN20271234/42.pdf', 60); // 60s
      // Still valid right away.
      expect(verifyEvidenceToken(token)?.key).toBe('civic_elective/GN20271234/42.pdf');
      // Roll forward 61 seconds — should be expired.
      vi.setSystemTime(t0 + 61_000);
      expect(verifyEvidenceToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a tampered token', () => {
    const token = signEvidenceToken('a/b.pdf', 60);
    const dot = token.indexOf('.');
    const flipped = token.slice(0, dot + 1) + (token.slice(dot + 1).startsWith('a') ? 'b' : 'a') + token.slice(dot + 2);
    expect(verifyEvidenceToken(flipped)).toBeNull();
  });
});

describe('sanitizeKey', () => {
  it('rejects ".." path traversal', () => {
    expect(() => sanitizeKey('../etc/passwd')).toThrow();
    expect(() => sanitizeKey('civic/../../escape.txt')).toThrow();
  });

  it('rejects absolute paths', () => {
    expect(() => sanitizeKey('/etc/passwd')).toThrow();
    expect(() => sanitizeKey('\\windows\\system32')).toThrow();
  });

  it('rejects empty / non-string keys', () => {
    expect(() => sanitizeKey('')).toThrow();
    // @ts-expect-error intentional non-string
    expect(() => sanitizeKey(null)).toThrow();
  });

  it('accepts well-formed relative keys', () => {
    expect(sanitizeKey('civic_elective/GN20271234/42-essay.pdf')).toBe('civic_elective/GN20271234/42-essay.pdf');
  });
});
