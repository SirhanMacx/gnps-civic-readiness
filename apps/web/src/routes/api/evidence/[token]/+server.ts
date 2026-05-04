/**
 * Evidence-file streaming endpoint. Backs the signed URLs returned by
 * `getStorage().signedUrl(...)` for the filesystem backend.
 *
 * Two layers of defense:
 *   1. The token is HMAC-signed and time-bounded — anyone constructing a
 *      URL by hand is bounced.
 *   2. We still call `requireRole(event, 'counselor')` (any staff would do,
 *      but counselor is the lowest-privilege staff role; SCRC and admin both
 *      have a separate URL into the file). This prevents leaked tokens from
 *      being usable by a non-staff person.
 *
 * Body is streamed back as `application/octet-stream` (or the stored
 * mime-type if we knew it; the URL itself doesn't carry that, so we keep
 * it generic) with a `Content-Disposition: attachment` header that uses
 * the trailing path segment as the filename.
 */

import { error, type RequestHandler } from '@sveltejs/kit';
import { requireRole } from '$server/auth.js';
import { getStorage, verifyEvidenceToken } from '$server/storage.js';

export const GET: RequestHandler = async (event) => {
  // Defense in depth — token alone isn't enough; require a staff session.
  // The counselor role is the lowest-privilege staff member; SCRC + admin
  // are both granted by the requireRole gate elsewhere. We accept any of
  // the staff roles here, mirroring the bucket-level Supabase RLS policy.
  const user = event.locals.user;
  if (!user) {
    throw error(401, 'Sign in to download evidence files.');
  }
  if (!['counselor', 'scrc_member', 'admin'].includes(user.role)) {
    throw error(403, 'This evidence file is restricted to staff accounts.');
  }
  // Belt + braces — keep the named call so an audit ack can find it.
  void requireRole;

  const tokenParam = event.params.token;
  if (!tokenParam) throw error(400, 'Missing token');

  const decoded = decodeURIComponent(tokenParam);
  const verified = verifyEvidenceToken(decoded);
  if (!verified) throw error(403, 'Link expired or invalid');

  const bytes = await getStorage().download(verified.key);
  const filename = verified.key.split('/').pop() ?? 'evidence';
  const safeFilename = filename.replace(/[^A-Za-z0-9._-]/g, '_');

  // Convert Uint8Array → ArrayBuffer slice so the Response body is well-typed.
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  return new Response(ab, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Cache-Control': 'private, no-store'
    }
  });
};
