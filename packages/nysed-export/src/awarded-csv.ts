/**
 * awarded_students.csv — the same schema as roster.csv, restricted to students
 * whose status === "awarded". This is the file the GNPS transcript office
 * ingests to flag transcripts for the Seal of Civic Readiness designation.
 */

import { ROSTER_HEADERS, studentToCsvRow } from './roster-csv.js';
import { csvFromRows } from './csv-utils.js';
import type { StudentRow } from './types.js';

export function awardedCsv(students: readonly StudentRow[]): string {
	const filtered = students.filter((s) => s.status === 'awarded');
	return csvFromRows(ROSTER_HEADERS, filtered.map(studentToCsvRow));
}
