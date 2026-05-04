import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { auditCsv } from '../src/audit-csv.js';
import { awardedCsv } from '../src/awarded-csv.js';
import { renderStudentPdf } from '../src/student-pdf.js';
import { rosterCsv } from '../src/roster-csv.js';
import { bundleZip } from '../src/zip-bundle.js';
import type {
	AuditRow,
	EvidenceFile,
	StudentRow,
} from '../src/types.js';

/**
 * End-to-end smoke test: stitch every module together for two students and
 * verify the resulting zip mirrors §4.5 of the design spec exactly.
 */
describe('end-to-end audit pack', () => {
	it('produces a class-of-2027-style audit pack with the spec layout', async () => {
		const maya: StudentRow = {
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
		};
		const david: StudentRow = {
			id: 'GN20275511',
			lastName: 'Chen',
			firstName: 'David',
			gradYear: 2027,
			status: 'in_progress',
			knowledge: 1.5,
			participation: 1.0,
			total: 2.5,
			eligible: false,
		};
		const students = [maya, david];

		const audit: AuditRow[] = [
			{ occurredAt: '2027-04-01T10:00:00Z', action: 'submission_created', actorKind: 'student', targetType: 'pathway_submission', targetId: 's1' },
			{ occurredAt: '2027-04-15T10:00:00Z', action: 'submission_awarded', actorKind: 'counselor', targetType: 'pathway_submission', targetId: 's1' },
		];

		const studentPdfs = new Map<string, Uint8Array>();
		for (const s of students) {
			const stem = `${s.id}_${s.lastName}_${s.firstName}`;
			studentPdfs.set(
				stem,
				await renderStudentPdf({
					student: s,
					submissions: [],
					regents: [],
					enrollment: [],
					auditExcerpt: audit,
				}),
			);
		}

		const evidenceFiles = new Map<string, EvidenceFile[]>();
		evidenceFiles.set(maya.id, [
			{
				filename: 'service_learning_reflection.pdf',
				mimeType: 'application/pdf',
				sizeBytes: 24,
				kind: 'reflection',
				bytes: new TextEncoder().encode('reflection content here'),
				domainTags: ['knowledge', 'experiences'],
			},
			{
				filename: 'capstone_artifact_v3.pdf',
				mimeType: 'application/pdf',
				sizeBytes: 19,
				kind: 'capstone_artifact',
				bytes: new TextEncoder().encode('capstone v3 artifact'),
				domainTags: ['skills', 'mindsets'],
			},
		]);

		const zipBytes = bundleZip({
			studentPdfs,
			rosterCsv: rosterCsv(students),
			awardedCsv: awardedCsv(students),
			auditCsv: auditCsv(audit),
			evidenceFiles,
		});

		expect(zipBytes.byteLength).toBeGreaterThan(2000);
		const extracted = unzipSync(zipBytes);
		const paths = Object.keys(extracted).sort();

		// Canonical paths from spec §4.5.
		expect(paths).toEqual([
			'audit_log_excerpt.csv',
			'awarded_students.csv',
			'evidence_files/GN20271234/capstone_artifact_v3.pdf',
			'evidence_files/GN20271234/service_learning_reflection.pdf',
			'per_student/GN20271234_Goldberg_Maya.pdf',
			'per_student/GN20275511_Chen_David.pdf',
			'roster.csv',
		]);

		// Per-student PDFs round-trip and start with %PDF.
		const mayaPdf = extracted['per_student/GN20271234_Goldberg_Maya.pdf']!;
		expect(mayaPdf[0]).toBe(0x25);
		expect(mayaPdf[1]).toBe(0x50);
		expect(mayaPdf[2]).toBe(0x44);
		expect(mayaPdf[3]).toBe(0x46);

		// awarded_students.csv excludes David.
		const awardedText = new TextDecoder().decode(extracted['awarded_students.csv']!);
		expect(awardedText).toContain('Goldberg');
		expect(awardedText).not.toContain('Chen');
	});
});
