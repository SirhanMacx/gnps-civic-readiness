/**
 * Self-host evidence-file storage.
 *
 * Backends:
 *   - 'fs' (default) — files written under EVIDENCE_DIR (default ./.evidence-data).
 *                       signedUrl returns /api/evidence/<HMAC token> with 1-hour TTL.
 *   - 's3'           — lazy-loads @aws-sdk/client-s3 on first call. The dep
 *                       is NOT added to package.json by default; admins running
 *                       in S3 mode `pnpm add @aws-sdk/client-s3` themselves.
 *
 * Both backends share the same `StorageBackend` interface so the rest of the
 * app never branches on the backend. Keys are sanitized: '..' segments and
 * absolute paths are rejected before any disk write or read.
 *
 * Token format for signedUrl (fs backend):
 *   base64url( JSON({ key, exp }) ) + '.' + hex( HMAC-SHA-256(payload, secret) )
 *
 * Verification + the `requireRole(event, 'counselor')` gate inside
 * /api/evidence/[token]/+server.ts give us defense-in-depth — a leaked
 * token alone isn't enough; the caller must also be staff.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { env } from '$env/dynamic/private';

export interface StoredFile {
  storagePath: string;
  size: number;
  contentType: string;
}

export interface StorageBackend {
  upload(key: string, bytes: Uint8Array, contentType: string): Promise<StoredFile>;
  download(key: string): Promise<Uint8Array>;
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Key sanitization
// ---------------------------------------------------------------------------

/**
 * Refuse keys that escape the storage root. `..` segments, absolute paths,
 * and empty strings are all rejected — caller's responsibility to pass a
 * clean relative key like `civic_elective/<student>/<id>-<file>`.
 */
export function sanitizeKey(key: string): string {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('storage key must be a non-empty string');
  }
  if (key.startsWith('/') || key.startsWith('\\')) {
    throw new Error(`storage key must be relative: ${key}`);
  }
  // Normalize separators so split-on-/ works on Windows-y inputs.
  const normalized = key.replace(/\\/g, '/');
  for (const part of normalized.split('/')) {
    if (part === '..' || part === '.') {
      throw new Error(`storage key contains illegal segment: ${key}`);
    }
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// HMAC token helpers (signed URLs)
// ---------------------------------------------------------------------------

interface SignedPayload {
  k: string; // sanitized key
  e: number; // unix-seconds expiry
}

const URL_TOKEN_SEPARATOR = '.';

function getSecretBytes(): Buffer {
  const secret = env.SIGNED_LINK_SECRET;
  if (secret && secret.length >= 16) return Buffer.from(secret);
  return Buffer.from('gnps-civic-dev-only-do-not-use-in-prod');
}

export function signEvidenceToken(key: string, ttlSeconds: number): string {
  const sane = sanitizeKey(key);
  const payload: SignedPayload = {
    k: sane,
    e: Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(ttlSeconds))
  };
  const json = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = createHmac('sha256', getSecretBytes()).update(json).digest('hex');
  return `${json.toString('base64url')}${URL_TOKEN_SEPARATOR}${sig}`;
}

export function verifyEvidenceToken(token: string): { key: string } | null {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf(URL_TOKEN_SEPARATOR);
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: SignedPayload;
  try {
    const json = Buffer.from(payloadB64, 'base64url');
    const expected = createHmac('sha256', getSecretBytes()).update(json).digest('hex');
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    payload = JSON.parse(json.toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload?.k !== 'string' || typeof payload?.e !== 'number') return null;
  if (payload.e < Math.floor(Date.now() / 1000)) return null;
  try {
    const sane = sanitizeKey(payload.k);
    return { key: sane };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Filesystem backend
// ---------------------------------------------------------------------------

class FsBackend implements StorageBackend {
  constructor(private readonly root: string) {}

  private absPath(key: string): string {
    const sane = sanitizeKey(key);
    const abs = path.join(this.root, sane);
    // Defense in depth: require the resolved path to stay inside root.
    const resolved = path.resolve(abs);
    const rootResolved = path.resolve(this.root);
    if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
      throw new Error(`storage key escapes root: ${key}`);
    }
    return abs;
  }

  async upload(key: string, bytes: Uint8Array, contentType: string): Promise<StoredFile> {
    const abs = this.absPath(key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, bytes);
    return { storagePath: sanitizeKey(key), size: bytes.byteLength, contentType };
  }

  async download(key: string): Promise<Uint8Array> {
    const abs = this.absPath(key);
    const buf = await fs.readFile(abs);
    return new Uint8Array(buf);
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const token = signEvidenceToken(key, ttlSeconds);
    return `/api/evidence/${encodeURIComponent(token)}`;
  }

  async delete(key: string): Promise<void> {
    const abs = this.absPath(key);
    await fs.rm(abs, { force: true });
  }
}

// ---------------------------------------------------------------------------
// S3 backend (lazy)
// ---------------------------------------------------------------------------

/**
 * Defer @aws-sdk/client-s3 to runtime so vite/rollup doesn't try to resolve
 * the package at build time. Districts running with STORAGE_BACKEND=fs (the
 * default) never pay the cost.
 *
 * Run `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` before
 * setting STORAGE_BACKEND=s3.
 */
async function loadAwsModule(name: '@aws-sdk/client-s3' | '@aws-sdk/s3-request-presigner'): Promise<Record<string, unknown>> {
  // The string concatenation defeats vite's static analysis — the module
  // is only resolved at runtime, after the admin has installed the optional dep.
  const dynName = name.split('@aws-sdk/').slice(1).join('@aws-sdk/');
  const fullName = '@aws-sdk/' + dynName;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<Record<string, unknown>>;
  return dynImport(fullName);
}

class S3Backend implements StorageBackend {
  private clientPromise: Promise<unknown> | null = null;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor() {
    const bucket = env.S3_BUCKET;
    if (!bucket) {
      throw new Error('STORAGE_BACKEND=s3 requires S3_BUCKET env var');
    }
    this.bucket = bucket;
    this.prefix = (env.S3_PREFIX ?? '').replace(/^\/+|\/+$/g, '');
  }

  private async getClient(): Promise<unknown> {
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      try {
        const mod = await loadAwsModule('@aws-sdk/client-s3');
        const S3ClientCtor = mod.S3Client as new (cfg: unknown) => unknown;
        return new S3ClientCtor({
          region: env.AWS_REGION ?? 'us-east-1',
          endpoint: env.S3_ENDPOINT || undefined,
          forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true' ? true : undefined
        });
      } catch (e) {
        throw new Error(
          'STORAGE_BACKEND=s3 selected but @aws-sdk/client-s3 is not installed. ' +
            'Run `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`. ' +
            'Underlying error: ' +
            (e instanceof Error ? e.message : String(e))
        );
      }
    })();
    return this.clientPromise;
  }

  private fullKey(key: string): string {
    const sane = sanitizeKey(key);
    return this.prefix ? `${this.prefix}/${sane}` : sane;
  }

  async upload(key: string, bytes: Uint8Array, contentType: string): Promise<StoredFile> {
    const sane = sanitizeKey(key);
    const mod = await loadAwsModule('@aws-sdk/client-s3');
    const PutObjectCommand = mod.PutObjectCommand as new (cfg: unknown) => unknown;
    const client = (await this.getClient()) as { send: (cmd: unknown) => Promise<unknown> };
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(sane),
        Body: bytes,
        ContentType: contentType
      })
    );
    return { storagePath: sane, size: bytes.byteLength, contentType };
  }

  async download(key: string): Promise<Uint8Array> {
    const mod = await loadAwsModule('@aws-sdk/client-s3');
    const GetObjectCommand = mod.GetObjectCommand as new (cfg: unknown) => unknown;
    const client = (await this.getClient()) as { send: (cmd: unknown) => Promise<unknown> };
    const res = (await client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) })
    )) as { Body?: { transformToByteArray?: () => Promise<Uint8Array> } };
    if (!res.Body || typeof res.Body.transformToByteArray !== 'function') {
      throw new Error('S3 GetObject returned no body');
    }
    return res.Body.transformToByteArray();
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const s3Mod = await loadAwsModule('@aws-sdk/client-s3');
    const presignerMod = await loadAwsModule('@aws-sdk/s3-request-presigner');
    const GetObjectCommand = s3Mod.GetObjectCommand as new (cfg: unknown) => unknown;
    const getSignedUrl = presignerMod.getSignedUrl as (
      client: unknown,
      cmd: unknown,
      opts: { expiresIn: number }
    ) => Promise<string>;
    const client = await this.getClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
      { expiresIn: ttlSeconds }
    );
  }

  async delete(key: string): Promise<void> {
    const mod = await loadAwsModule('@aws-sdk/client-s3');
    const DeleteObjectCommand = mod.DeleteObjectCommand as new (cfg: unknown) => unknown;
    const client = (await this.getClient()) as { send: (cmd: unknown) => Promise<unknown> };
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }));
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let cachedBackend: StorageBackend | null = null;

export function getStorage(): StorageBackend {
  if (cachedBackend) return cachedBackend;
  const backend = (env.STORAGE_BACKEND ?? 'fs').toLowerCase();
  if (backend === 's3') {
    cachedBackend = new S3Backend();
  } else {
    const root = env.EVIDENCE_DIR && env.EVIDENCE_DIR.length > 0 ? env.EVIDENCE_DIR : '.evidence-data';
    cachedBackend = new FsBackend(path.resolve(root));
  }
  return cachedBackend;
}

/** Reset the cached backend — used in tests. Not exported via public API; */
export function _resetStorageForTests(): void {
  cachedBackend = null;
}
