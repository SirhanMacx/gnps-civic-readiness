import { describe, expect, it } from 'vitest';
import { rosterCsv } from '../src/roster-csv.js';
import type { StudentRow } from '../src/types.js';

const baseStudent = (overrides: Partial<StudentRow> = {}): StudentRow => ({
	id: 'GN20271234',
	lastName: 'Goldberg',
	firstName: 'Maya',
	gradYear: 2027,
	status: 'awarded',
	knowledge: 2.5,
	participation: 3.5,
	total: 6.0,
	eligible: true,
	awardedAt: '2027-05-15T13:00:00Z',
	...overrides,
});

describe('rosterCsv', () => {
	it('emits the canonical RFC 4180 header', () => {
		const csv = rosterCsv([]);
		expect(csv.split(/\r\n/)[0]).toBe(
			'student_id,last_name,first_name,grad_year,knowledge,participation,total,status,eligible,awarded_at',
		);
	});

	it('serializes a basic student row with no escaping needed', () => {
		const csv = rosterCsv([baseStudent()]);
		const lines = csv.split(/\r\n/);
		expect(lines[1]).toBe(
			'GN20271234,Goldberg,Maya,2027,2.5,3.5,6,awarded,true,2027-05-15T13:00:00Z',
		);
	});

	it('escapes fields containing commas by wrapping in double quotes', () => {
		const csv = rosterCsv([
			baseStudent({ lastName: 'Garcia, Jr.' }),
		]);
		const lines = csv.split(/\r\n/);
		expect(lines[1]).toContain('"Garcia, Jr."');
	});

	it('escapes embedded double quotes by doubling them', () => {
		const csv = rosterCsv([
			baseStudent({ lastName: 'O"Hara' }),
		]);
		const lines = csv.split(/\r\n/);
		// O"Hara is wrapped and the embedded quote becomes ""
		expect(lines[1]).toContain('"O""Hara"');
	});

	it('escapes embedded newlines', () => {
		const csv = rosterCsv([
			baseStudent({ firstName: 'Maya\nLee' }),
		]);
		// Newline must remain inside a quoted field, so the row keeps a single
		// logical record but the raw string contains 2 \n inside quotes.
		expect(csv).toContain('"Maya\nLee"');
	});

	it('preserves Unicode characters in firstName / lastName', () => {
		const csv = rosterCsv([
			baseStudent({ firstName: 'Mañuel', lastName: '北野' }),
		]);
		expect(csv).toContain('Mañuel');
		expect(csv).toContain('北野');
	});

	it('renders a missing awardedAt as an empty trailing field', () => {
		const csv = rosterCsv([
			baseStudent({ status: 'in_progress', awardedAt: undefined, eligible: false }),
		]);
		const lines = csv.split(/\r\n/);
		expect(lines[1]?.endsWith(',in_progress,false,')).toBe(true);
	});

	it('appends a trailing CRLF after the final record (RFC 4180 friendly)', () => {
		const csv = rosterCsv([baseStudent()]);
		expect(csv.endsWith('\r\n')).toBe(true);
	});
});
