import { supabaseAdmin } from './supabase.js';
import { verifyToken } from './email.js';

export type ConfirmFailureReason =
  | 'invalid_token'
  | 'not_found'
  | 'already_resolved'
  | 'db_error';

export type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: ConfirmFailureReason };

interface ConfirmInput {
  /** The signed token from the URL — "<uuid>.<sig>". */
  token: string;
  /** Caller IP for the audit trail. May be null when running outside an HTTP request. */
  ip: string | null;
}

interface DisputeInput extends ConfirmInput {
  reason: string;
}

/**
 * Mark a hours_log row as confirmed. Token must be a valid HMAC-signed token
 * produced by signToken(). Idempotent in spirit: re-clicks return
 * 'already_resolved' rather than overwriting state.
 *
 * Writes an `audit_log` row with action='supervisor_confirmed_hours' so
 * NYSED auditors can trace each awarded hour to a supervisor click.
 */
export async function confirmHours(input: ConfirmInput): Promise<ConfirmResult> {
  const uuid = verifyToken(input.token);
  if (!uuid) return { ok: false, reason: 'invalid_token' };

  const sb = supabaseAdmin();
  const { data: log, error: eFetch } = await sb
    .from('hours_log')
    .select('id, hours, supervisor_email, confirmation_status')
    .eq('confirmation_token', uuid)
    .maybeSingle();
  if (eFetch) {
    console.error('[confirmHours] fetch failed:', eFetch.message);
    return { ok: false, reason: 'db_error' };
  }
  if (!log) return { ok: false, reason: 'not_found' };
  if (log.confirmation_status !== 'pending') {
    return { ok: false, reason: 'already_resolved' };
  }

  const nowIso = new Date().toISOString();
  const { error: eUpdate } = await sb
    .from('hours_log')
    .update({
      confirmation_status: 'confirmed',
      confirmation_responded_at: nowIso,
      confirmer_ip: input.ip
    })
    .eq('id', log.id);
  if (eUpdate) {
    console.error('[confirmHours] update failed:', eUpdate.message);
    return { ok: false, reason: 'db_error' };
  }

  await sb.from('audit_log').insert({
    actor_kind: 'supervisor',
    action: 'supervisor_confirmed_hours',
    target_type: 'hours_log',
    target_id: String(log.id),
    ip: input.ip,
    data: { hours: log.hours, supervisor_email: log.supervisor_email }
  });

  return { ok: true };
}

/**
 * Mark a hours_log row as disputed. Stores the supervisor's free-text reason
 * for a counselor to triage. Unlike confirmHours, dispute can override an
 * already-confirmed state ONLY in 'pending' to avoid letting a stale link
 * undo a confirmation — the same already_resolved behavior.
 */
export async function disputeHours(input: DisputeInput): Promise<ConfirmResult> {
  const uuid = verifyToken(input.token);
  if (!uuid) return { ok: false, reason: 'invalid_token' };

  const reason = (input.reason ?? '').trim().slice(0, 1000);

  const sb = supabaseAdmin();
  const { data: log, error: eFetch } = await sb
    .from('hours_log')
    .select('id, hours, supervisor_email, confirmation_status')
    .eq('confirmation_token', uuid)
    .maybeSingle();
  if (eFetch) {
    console.error('[disputeHours] fetch failed:', eFetch.message);
    return { ok: false, reason: 'db_error' };
  }
  if (!log) return { ok: false, reason: 'not_found' };
  if (log.confirmation_status !== 'pending') {
    return { ok: false, reason: 'already_resolved' };
  }

  const nowIso = new Date().toISOString();
  const { error: eUpdate } = await sb
    .from('hours_log')
    .update({
      confirmation_status: 'disputed',
      confirmation_responded_at: nowIso,
      confirmer_ip: input.ip,
      confirmation_dispute_reason: reason
    })
    .eq('id', log.id);
  if (eUpdate) {
    console.error('[disputeHours] update failed:', eUpdate.message);
    return { ok: false, reason: 'db_error' };
  }

  await sb.from('audit_log').insert({
    actor_kind: 'supervisor',
    action: 'supervisor_disputed_hours',
    target_type: 'hours_log',
    target_id: String(log.id),
    ip: input.ip,
    data: { reason, hours: log.hours, supervisor_email: log.supervisor_email }
  });

  return { ok: true };
}
