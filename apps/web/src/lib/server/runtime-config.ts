/**
 * Runtime configuration guardrails.
 *
 * Build-time checks are intentionally avoided because platform builds can run
 * before production secrets are injected. The hook calls this on the first real
 * request so a production process with unsafe secrets fails loudly.
 */

import { env } from '$env/dynamic/private';

const MIN_SECRET_LENGTH = 32;
let checked = false;

function hasStrongSecret(value: string | undefined): boolean {
  return typeof value === 'string' && value.length >= MIN_SECRET_LENGTH;
}

export function assertProductionRuntimeConfig(): void {
  if (checked) return;

  const pgssl = (env.PGSSL ?? 'false').toLowerCase();
  if (pgssl !== 'true' && pgssl !== 'false') {
    throw new Error('PGSSL must be either "true" or "false".');
  }

  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (!hasStrongSecret(env.SESSION_SECRET)) {
      problems.push('SESSION_SECRET must be set to a 32+ character random value');
    }
    if (!hasStrongSecret(env.SIGNED_LINK_SECRET)) {
      problems.push('SIGNED_LINK_SECRET must be set to a 32+ character random value');
    }
    if (problems.length > 0) {
      throw new Error('Production configuration error: ' + problems.join('; ') + '.');
    }
  }

  checked = true;
}
