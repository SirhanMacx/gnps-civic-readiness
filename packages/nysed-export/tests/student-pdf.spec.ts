import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderStudentPdf } from '../src/student-pdf.js';
import type {
	AuditRow,
	EnrollmentRow,
	RegentsRow,
	StudentRow,
	SubmissionRow,
} from '../src/types.js';

const student: StudentRow = {
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

const submissions: SubmissionRow[] = [
	{
		id: 's1',
		pathwayType: 'service_learning',
		status: 'awarded',
		pointsAwarded: 1.5,
		submittedAt: '2026-10-01T12:00:00Z',
		scoredAt: '2026-10-15T12:00:00Z',
		awardedAt: '2026-10-20T12:00:00Z',
	},
	{
		id: 's2',
		pathwayType: 'hs_capstone',
		status: 'awarded',
		pointsAwarded: 2.0,
		submittedAt: '2027-02-01T12:00:00Z',
		scoredAt: '2027-02-20T12:00:00Z',
		awardedAt: '2027-02-25T12:00:00Z',
	},
];

const regents: RegentsRow[] = [
	{ exam: 'US History', score: 88, examDate: '2026-06-15', safetyNet: false },
	{ exam: 'Global History', score: 72, examDate: '2025-06-15', safetyNet: false },
];

const enrollment: EnrollmentRow[] = [
	{ courseCode: 'PART-12', courseTitle: 'Participation in Government', schoolYear: '2026-2027', finalGrade: '92', creditStatus: 'earned' },
];

const auditExcerpt: AuditRow[] = Array.from({ length: 12 }, (_, i) => ({
	occurredAt: `2027-04-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
	action: i % 2 === 0 ? 'submission_created' : 'submission_awarded',
	actorKind: i % 3 === 0 ? 'student' : 'counselor',
	targetType: 'pathway_submission',
	targetId: `submission-${i}`,
}));

describe('renderStudentPdf', () => {
	it('produces a Uint8Array with the %PDF magic header', async () => {
		const buf = await renderStudentPdf({ student, submissions, regents, enrollment, auditExcerpt });
		expect(buf).toBeInstanceOf(Uint8Array);
		expect(buf[0]).toBe(0x25); // %
		expect(buf[1]).toBe(0x50); // P
		expect(buf[2]).toBe(0x44); // D
		expect(buf[3]).toBe(0x46); // F
	});

	it('produces at least one page', async () => {
		const buf = await renderStudentPdf({ student, submissions, regents, enrollment, auditExcerpt });
		const doc = await PDFDocument.load(buf);
		expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
	});

	it('uses LETTER size (612 × 792) for the first page', async () => {
		const buf = await renderStudentPdf({ student, submissions, regents, enrollment, auditExcerpt });
		const doc = await PDFDocument.load(buf);
		const page = doc.getPage(0);
		expect(page.getWidth()).toBeCloseTo(612, 0);
		expect(page.getHeight()).toBeCloseTo(792, 0);
	});

	it('handles a student with no submissions / regents / enrollment / audit', async () => {
		const minimal: StudentRow = {
			id: 'GN20275511',
			lastName: 'Chen',
			firstName: 'David',
			gradYear: 2027,
			status: 'in_progress',
			knowledge: 0,
			participation: 0,
			total: 0,
			eligible: false,
		};
		const buf = await renderStudentPdf({
			student: minimal,
			submissions: [],
			regents: [],
			enrollment: [],
			auditExcerpt: [],
		});
		expect(buf[0]).toBe(0x25);
		expect(buf.byteLength).toBeGreaterThan(500);
	});
});
