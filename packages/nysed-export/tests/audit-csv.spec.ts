import { describe, expect, it } from 'vitest';
import { auditCsv } from '../src/audit-csv.js';
import type { AuditRow } from '../src/types.js';

describe('auditCsv', () => {
	it('emits the spec-defined header', () => {
		const csv = auditCsv([]);
		expect(csv.split(/\r\n/)[0]).toBe('occurred_at,action,actor_kind,target_type,target_id');
	});

	it('serializes rows in input order', () => {
		const rows: AuditRow[] = [
			{
				occurredAt: '2027-04-01T12:00:00Z',
				action: 'submission_created',
				actorKind: 'student',
				targetType: 'pathway_submission',
				targetId: 'sub-1',
			},
			{
				occurredAt: '2027-04-02T12:00:00Z',
				action: 'submission_awarded',
				actorKind: 'counselor',
				targetType: 'pathway_submission',
				targetId: 'sub-1',
			},
		];
		const csv = auditCsv(rows);
		const lines = csv.split(/\r\n/);
		expect(lines[1]).toBe('2027-04-01T12:00:00Z,submission_created,student,pathway_submission,sub-1');
		expect(lines[2]).toBe('2027-04-02T12:00:00Z,submission_awarded,counselor,pathway_submission,sub-1');
	});

	it('escapes commas in target_id', () => {
		const csv = auditCsv([
			{
				occurredAt: '2027-04-01T12:00:00Z',
				action: 'note_added',
				actorKind: 'admin',
				targetType: 'student',
				targetId: 'GN1234,with-comma',
			},
		]);
		expect(csv).toContain('"GN1234,with-comma"');
	});
});
