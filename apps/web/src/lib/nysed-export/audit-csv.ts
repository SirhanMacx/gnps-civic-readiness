/**
 * audit_log_excerpt.csv — the every-state-transition log for the audit pack.
 *
 * Header order matches the spec §4.5 description and the order in
 * supabase/migrations/<initial>.sql `audit_log` table for diff-friendliness.
 */

import { csvFromRows } from './csv-utils.js';
import type { AuditRow } from './types.js';

export const AUDIT_HEADERS = [
	'occurred_at',
	'action',
	'actor_kind',
	'target_type',
	'target_id',
] as const;

type AuditCsvRow = Record<(typeof AUDIT_HEADERS)[number], string>;

export function auditCsv(rows: readonly AuditRow[]): string {
	const mapped: AuditCsvRow[] = rows.map((r) => ({
		occurred_at: r.occurredAt,
		action: r.action,
		actor_kind: r.actorKind,
		target_type: r.targetType,
		target_id: r.targetId,
	}));
	return csvFromRows(AUDIT_HEADERS, mapped);
}
