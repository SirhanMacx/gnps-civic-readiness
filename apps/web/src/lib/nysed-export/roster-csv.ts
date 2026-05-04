/**
 * roster.csv — every student in the cohort with eligibility status.
 *
 * Header order is fixed so peer-district forks and the GNPS transcript office
 * can wire the export into existing tooling without surprises.
 */

import { csvFromRows } from './csv-utils.js';
import type { StudentRow } from './types.js';

export const ROSTER_HEADERS = [
	'student_id',
	'last_name',
	'first_name',
	'grad_year',
	'knowledge',
	'participation',
	'total',
	'status',
	'eligible',
	'awarded_at',
] as const;

type RosterCsvRow = Record<(typeof ROSTER_HEADERS)[number], string | number | boolean>;

export function studentToCsvRow(s: StudentRow): RosterCsvRow {
	return {
		student_id: s.id,
		last_name: s.lastName,
		first_name: s.firstName,
		grad_year: s.gradYear,
		knowledge: s.knowledge,
		participation: s.participation,
		total: s.total,
		status: s.status,
		eligible: s.eligible,
		awarded_at: s.awardedAt ?? '',
	};
}

export function rosterCsv(students: readonly StudentRow[]): string {
	return csvFromRows(ROSTER_HEADERS, students.map(studentToCsvRow));
}
