import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { bundleZip } from '../src/zip-bundle.js';
import type { EvidenceFile } from '../src/types.js';

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('bundleZip', () => {
	it('produces a zip archive that round-trips through unzipSync', () => {
		const studentPdfs = new Map<string, Uint8Array>();
		studentPdfs.set('GN20271234_Goldberg_Maya', utf8('%PDF-1.4 fake-pdf-1'));
		studentPdfs.set('GN20275511_Chen_David', utf8('%PDF-1.4 fake-pdf-2'));

		const evidenceFiles = new Map<string, EvidenceFile[]>();
		evidenceFiles.set('GN20271234', [
			{
				filename: 'service_learning_reflection.pdf',
				mimeType: 'application/pdf',
				sizeBytes: 12,
				kind: 'reflection',
				bytes: utf8('reflection!'),
				domainTags: ['knowledge', 'experiences'],
			},
		]);

		const zipBytes = bundleZip({
			studentPdfs,
			rosterCsv: 'student_id,last_name\r\nGN20271234,Goldberg\r\n',
			awardedCsv: 'student_id,last_name\r\nGN20271234,Goldberg\r\n',
			auditCsv: 'occurred_at,action\r\n',
			evidenceFiles,
		});

		expect(zipBytes).toBeInstanceOf(Uint8Array);
		expect(zipBytes.byteLength).toBeGreaterThan(0);

		const extracted = unzipSync(zipBytes);
		const paths = Object.keys(extracted).sort();

		expect(paths).toContain('roster.csv');
		expect(paths).toContain('awarded_students.csv');
		expect(paths).toContain('audit_log_excerpt.csv');
		expect(paths).toContain('per_student/GN20271234_Goldberg_Maya.pdf');
		expect(paths).toContain('per_student/GN20275511_Chen_David.pdf');
		expect(paths).toContain('evidence_files/GN20271234/service_learning_reflection.pdf');

		// Re-decoded contents should match.
		expect(strFromU8(extracted['roster.csv']!)).toContain('Goldberg');
		expect(strFromU8(extracted['per_student/GN20271234_Goldberg_Maya.pdf']!)).toContain('fake-pdf-1');
	});

	it('handles empty evidence map without producing the evidence_files prefix', () => {
		const studentPdfs = new Map<string, Uint8Array>();
		studentPdfs.set('GN20271234_Goldberg_Maya', utf8('%PDF-fake'));

		const zipBytes = bundleZip({
			studentPdfs,
			rosterCsv: 'h\r\n',
			awardedCsv: 'h\r\n',
			auditCsv: 'h\r\n',
			evidenceFiles: new Map(),
		});

		const paths = Object.keys(unzipSync(zipBytes));
		expect(paths.some((p) => p.startsWith('evidence_files/'))).toBe(false);
		expect(paths).toContain('per_student/GN20271234_Goldberg_Maya.pdf');
	});

	it('sanitizes evidence filenames containing path separators or null bytes', () => {
		const studentPdfs = new Map<string, Uint8Array>();
		studentPdfs.set('GN1_A_B', utf8('%PDF-x'));

		const evidenceFiles = new Map<string, EvidenceFile[]>();
		evidenceFiles.set('GN1', [
			{
				filename: '../../etc/passwd',
				mimeType: 'application/pdf',
				sizeBytes: 1,
				kind: 'reflection',
				bytes: utf8('x'),
				domainTags: [],
			},
		]);

		const zipBytes = bundleZip({
			studentPdfs,
			rosterCsv: '',
			awardedCsv: '',
			auditCsv: '',
			evidenceFiles,
		});
		const paths = Object.keys(unzipSync(zipBytes));
		// No extracted path should escape the evidence_files/<studentId>/ folder.
		expect(paths.some((p) => p.includes('..'))).toBe(false);
		expect(paths.some((p) => p.startsWith('evidence_files/GN1/'))).toBe(true);
	});
});
