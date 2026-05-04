import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../src/lib/server/email.js';

describe('signToken / verifyToken', () => {
  it('round-trips a UUID', () => {
    const uuid = '11111111-2222-3333-4444-555555555555';
    const tok = signToken(uuid);
    expect(tok).toMatch(/^[0-9a-f-]{36}\.[0-9a-f]{32}$/);
    expect(verifyToken(tok)).toBe(uuid);
  });

  it('round-trips multiple distinct UUIDs without cross-talk', () => {
    const a = '11111111-2222-3333-4444-555555555555';
    const b = '99999999-8888-7777-6666-555555555555';
    const tokA = signToken(a);
    const tokB = signToken(b);
    expect(verifyToken(tokA)).toBe(a);
    expect(verifyToken(tokB)).toBe(b);
    // Tokens must differ for differing UUIDs.
    expect(tokA).not.toBe(tokB);
  });

  it('rejects tampered token (sig mutated)', () => {
    const tok = signToken('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    // Flip the last hex char of the signature — keeps the length valid but invalidates the HMAC.
    const lastChar = tok.slice(-1);
    const flipped = lastChar === '0' ? '1' : '0';
    const tampered = tok.slice(0, -1) + flipped;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('rejects token with bad signature length', () => {
    const tok = signToken('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    // Remove one char from the signature so timingSafeEqual would otherwise throw.
    const truncated = tok.slice(0, -1);
    expect(verifyToken(truncated)).toBeNull();
    // Also test an over-long signature
    const overlong = tok + 'aa';
    expect(verifyToken(overlong)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyToken('')).toBeNull();
    expect(verifyToken('no-dot-separator')).toBeNull();
    expect(verifyToken('.')).toBeNull();
    expect(verifyToken('uuid-only.')).toBeNull();
    expect(verifyToken('.signature-only')).toBeNull();
  });
});
