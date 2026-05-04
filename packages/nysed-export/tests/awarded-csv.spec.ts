import { describe, expect, it } from 'vitest';
import { awardedCsv } from '../src/awarded-csv.js';
import type { StudentRow } from '../src/types.js';

const make = (overrides: Partial<StudentRow>): StudentRow => ({
	id: 'GN20271234',
	lastName: 'Doe',
	firstName: 'Jane',
	gradYear: 2027,
	status: 'in_progress',
	knowledge: 0,
	participation: 0,
	total: 0,
	eligible: false,
	...overrides,
});

describe('awardedCsv', () => {
	it('uses the same header as rosterCsv', () => {
		const csv = awardedCsv([]);
		expect(csv.split(/\r\n/)[0]).toBe(
			'student_id,last_name,first_name,grad_year,knowledge,participation,total,status,eligible,awarded_at',
		);
	});

	it('filters to only status === "awarded"', () => {
		const csv = awardedCsv([
			make({ id: 'A1', status: 'awarded', awardedAt: '2027-05-01T00:00:00Z', eligible: true, total: 6, knowledge: 3, participation: 3 }),
			make({ id: 'A2', status: 'in_progress' }),
			make({ id: 'A3', status: 'ready_for_review' }),
			make({ id: 'A4', status: 'awarded', awardedAt: '2027-05-02T00:00:00Z', eligible: true, total: 6.5, knowledge: 3, participation: 3.5 }),
			make({ id: 'A5', status: 'not_awarded' }),
		]);
		const lines = csv.split(/\r\n/).filter((l) => l.length > 0);
		// 1 header + 2 awarded rows
		expect(lines).toHaveLength(3);
		expect(lines[1]).toContain('A1');
		expect(lines[2]).toContain('A4');
		expect(csv).not.toContain('A2');
		expect(csv).not.toContain('A3');
		expect(csv).not.toContain('A5');
	});
});
