/**
 * @gnps-civic/nysed-export — public entry point.
 *
 * Re-exports every public type + function so consumers (the SvelteKit
 * /admin/export endpoint and any future CLI driver) can import from the
 * package root.
 */

export type {
	AuditRow,
	EnrollmentRow,
	EvidenceFile,
	RegentsRow,
	StudentRow,
	SubmissionRow,
} from './types.js';

export { rosterCsv, ROSTER_HEADERS, studentToCsvRow } from './roster-csv.js';
export { awardedCsv } from './awarded-csv.js';
export { auditCsv, AUDIT_HEADERS } from './audit-csv.js';
export { renderStudentPdf } from './student-pdf.js';
export type { RenderStudentPdfInput } from './student-pdf.js';
export { bundleZip } from './zip-bundle.js';
export type { BundleZipInput } from './zip-bundle.js';
export { csvCell, csvFromRows } from './csv-utils.js';
