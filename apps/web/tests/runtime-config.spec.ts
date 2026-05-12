import { describe, expect, it, vi } from 'vitest';

async function loadGuard(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.doMock('$env/dynamic/private', () => ({ env }));
  return import('../src/lib/server/runtime-config.js');
}

describe('assertProductionRuntimeConfig', () => {
  it('allows local/internal Docker Postgres with dev fallback secrets outside production', async () => {
    const { assertProductionRuntimeConfig } = await loadGuard({
      NODE_ENV: 'development',
      PGSSL: 'false'
    });

    expect(() => assertProductionRuntimeConfig()).not.toThrow();
  });

  it('allows managed Postgres TLS mode when explicitly enabled', async () => {
    const { assertProductionRuntimeConfig } = await loadGuard({
      NODE_ENV: 'production',
      PGSSL: 'true',
      SESSION_SECRET: 'session-secret-at-least-thirty-two-chars',
      SIGNED_LINK_SECRET: 'signed-link-secret-at-least-thirty-two'
    });

    expect(() => assertProductionRuntimeConfig()).not.toThrow();
  });

  it('rejects invalid PGSSL values', async () => {
    const { assertProductionRuntimeConfig } = await loadGuard({
      NODE_ENV: 'production',
      PGSSL: 'sometimes',
      SESSION_SECRET: 'session-secret-at-least-thirty-two-chars',
      SIGNED_LINK_SECRET: 'signed-link-secret-at-least-thirty-two'
    });

    expect(() => assertProductionRuntimeConfig()).toThrow('PGSSL must be either "true" or "false".');
  });

  it('requires strong production signing secrets', async () => {
    const { assertProductionRuntimeConfig } = await loadGuard({
      NODE_ENV: 'production',
      PGSSL: 'false',
      SESSION_SECRET: 'too-short',
      SIGNED_LINK_SECRET: ''
    });

    expect(() => assertProductionRuntimeConfig()).toThrow(
      'SESSION_SECRET must be set to a 32+ character random value'
    );
    expect(() => assertProductionRuntimeConfig()).toThrow(
      'SIGNED_LINK_SECRET must be set to a 32+ character random value'
    );
  });
});
