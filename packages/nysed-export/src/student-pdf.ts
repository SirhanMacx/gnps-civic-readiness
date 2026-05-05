/**
 * Per-student NYSED audit PDF.
 *
 * Single LETTER-size page (612 × 792 pt). The layout is intentionally compact
 * — one student, one page is what NYSED auditors expect for a quick bulk
 * review. Long submission lists, regents lists, enrollment, or audit excerpts
 * are clipped (with a footnote) rather than overflowing onto a second page.
 *
 * Brand tokens (navy + accent orange) come from the apps/web theme; we keep
 * them inline here because this package is consumed in a Vercel function with
 * no Svelte runtime.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import type {
	AuditRow,
	EnrollmentRow,
	RegentsRow,
	StudentRow,
	SubmissionRow,
} from './types.js';

export interface RenderStudentPdfInput {
	student: StudentRow;
	submissions: readonly SubmissionRow[];
	regents: readonly RegentsRow[];
	enrollment: readonly EnrollmentRow[];
	auditExcerpt: readonly AuditRow[];
}

const NAVY = rgb(0x20 / 255, 0x4a / 255, 0x97 / 255); // #204A97
const ACCENT = rgb(0xfe / 255, 0x81 / 255, 0x58 / 255); // #FE8158
const INK = rgb(0.13, 0.13, 0.15);
const MUTED = rgb(0.45, 0.45, 0.5);
const ELIGIBLE_GREEN = rgb(0.18, 0.55, 0.34);
const PILL_GRAY = rgb(0.6, 0.6, 0.65);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;

/**
 * Format an ISO timestamp as YYYY-MM-DD; on parse failure we fall back to the
 * raw string so an unexpected backend value still renders something readable.
 */
function ymd(iso: string | undefined): string {
	if (!iso) return '';
	const t = iso.length >= 10 ? iso.slice(0, 10) : iso;
	return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : iso;
}

/** Strip codepoints that StandardFonts (WinAnsi-encoded) cannot render. */
function safeWinAnsi(s: string): string {
	let out = '';
	for (const ch of s) {
		const code = ch.codePointAt(0) ?? 0;
		// WinAnsi is a 1-byte encoding; we approximate by allowing only the
		// Latin-1 range and replacing anything else with "?". This keeps the
		// PDF readable for districts whose roster data sneaks through Unicode
		// without forcing us to bundle a full TTF font.
		out += code < 0x100 ? ch : '?';
	}
	return out;
}

function regentsLevel(score: number, safetyNet: boolean): string {
	if (safetyNet) return 'Safety-Net / Appeal';
	if (score >= 85) return 'Mastery';
	if (score >= 65) return 'Proficiency';
	return 'Below Proficiency';
}

function pathwayLabel(pt: string): string {
	const map: Record<string, string> = {
		service_learning: 'Service-Learning',
		hs_capstone: 'HS Capstone Project',
		research_project: 'Research Project',
		hs_civic_project: 'HS Civic Project',
		civics_course_a: 'Civics Course (Pathway 1a)',
		civics_course_d: 'Civics Course (Pathway 1d)',
		participation_government: 'Participation in Government (2c)',
	};
	return map[pt] ?? pt;
}

interface FontPair {
	regular: PDFFont;
	bold: PDFFont;
}

/** Convenience wrapper: draw left-anchored text on the page. */
function drawText(
	page: PDFPage,
	text: string,
	x: number,
	y: number,
	size: number,
	font: PDFFont,
	color = INK,
): void {
	page.drawText(safeWinAnsi(text), { x, y, size, font, color });
}

/** Truncate to fit within `maxWidth` pixels at the given font size. */
function clip(font: PDFFont, text: string, size: number, maxWidth: number): string {
	const safe = safeWinAnsi(text);
	if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
	let lo = 0;
	let hi = safe.length;
	while (lo < hi) {
		const mid = (lo + hi + 1) >>> 1;
		const w = font.widthOfTextAtSize(safe.slice(0, mid) + '…', size);
		if (w <= maxWidth) lo = mid;
		else hi = mid - 1;
	}
	return safe.slice(0, lo) + '…';
}

function drawHeaderBar(page: PDFPage, fonts: FontPair): void {
	const barH = 70;
	page.drawRectangle({
		x: 0,
		y: PAGE_H - barH,
		width: PAGE_W,
		height: barH,
		color: NAVY,
	});
	drawText(page, 'GREAT NECK PUBLIC SCHOOLS', MARGIN, PAGE_H - 30, 14, fonts.bold, WHITE);
	drawText(
		page,
		'Seal of Civic Readiness — Student Audit Record',
		MARGIN,
		PAGE_H - 50,
		11,
		fonts.regular,
		WHITE,
	);
}

function drawStudentBlock(page: PDFPage, fonts: FontPair, student: StudentRow): number {
	let y = PAGE_H - 70 - 28;
	drawText(page, `${student.firstName} ${student.lastName}`, MARGIN, y, 18, fonts.bold);
	y -= 18;
	drawText(
		page,
		`Student ID: ${student.id}    ·    Class of ${student.gradYear}`,
		MARGIN,
		y,
		10,
		fonts.regular,
		MUTED,
	);

	// Eligibility pill (top-right of student block).
	const pillW = 130;
	const pillH = 22;
	const pillX = PAGE_W - MARGIN - pillW;
	const pillY = PAGE_H - 70 - 28 - 4;
	page.drawRectangle({
		x: pillX,
		y: pillY - 4,
		width: pillW,
		height: pillH,
		color: student.eligible ? ELIGIBLE_GREEN : PILL_GRAY,
		borderColor: ACCENT,
		borderWidth: 1.4,
	});
	const pillLabel = student.eligible ? 'ELIGIBLE' : 'NOT YET ELIGIBLE';
	const labelWidth = fonts.bold.widthOfTextAtSize(pillLabel, 10);
	drawText(
		page,
		pillLabel,
		pillX + (pillW - labelWidth) / 2,
		pillY + 4,
		10,
		fonts.bold,
		WHITE,
	);

	return y - 18;
}

function drawTwoColumnPathways(
	page: PDFPage,
	fonts: FontPair,
	yStart: number,
	student: StudentRow,
	submissions: readonly SubmissionRow[],
): number {
	const colW = (PAGE_W - MARGIN * 2 - 20) / 2;
	const leftX = MARGIN;
	const rightX = MARGIN + colW + 20;

	// Knowledge column = courses + civics-course pathways. Participation
	// column = service-learning + capstone + civic-project + research.
	const knowledgePathways = new Set([
		'civics_course_a',
		'civics_course_d',
		'participation_government',
	]);
	const knowledge = submissions.filter((s) => knowledgePathways.has(s.pathwayType));
	const participation = submissions.filter((s) => !knowledgePathways.has(s.pathwayType));

	drawText(page, 'Civic Knowledge', leftX, yStart, 12, fonts.bold, NAVY);
	drawText(page, 'Civic Participation', rightX, yStart, 12, fonts.bold, NAVY);

	const writeColumn = (
		x: number,
		rows: readonly SubmissionRow[],
		subtotal: number,
	): void => {
		let cursor = yStart - 16;
		const maxRows = 8;
		const visible = rows.slice(0, maxRows);
		if (visible.length === 0) {
			drawText(page, '— no submissions —', x, cursor, 9, fonts.regular, MUTED);
			cursor -= 14;
		}
		for (const r of visible) {
			const line = `${pathwayLabel(r.pathwayType)} · ${ymd(r.awardedAt ?? r.submittedAt)} · ${r.pointsAwarded.toFixed(1)}pt`;
			drawText(page, clip(fonts.regular, line, 9, colW), x, cursor, 9, fonts.regular);
			cursor -= 12;
		}
		if (rows.length > maxRows) {
			drawText(
				page,
				`+ ${rows.length - maxRows} more (see audit log)`,
				x,
				cursor,
				8,
				fonts.regular,
				MUTED,
			);
			cursor -= 12;
		}
		cursor -= 4;
		drawText(page, `Subtotal: ${subtotal.toFixed(1)} pt`, x, cursor, 10, fonts.bold, NAVY);
	};

	writeColumn(leftX, knowledge, student.knowledge);
	writeColumn(rightX, participation, student.participation);

	// Knowledge column gets at most ~ (8 rows * 12pt) + label + subtotal => ~140pt.
	return yStart - 150;
}

function drawTotalBanner(page: PDFPage, fonts: FontPair, y: number, student: StudentRow): number {
	const h = 36;
	page.drawRectangle({
		x: MARGIN,
		y: y - h,
		width: PAGE_W - MARGIN * 2,
		height: h,
		color: NAVY,
		borderColor: ACCENT,
		borderWidth: 1.5,
	});
	const eligLabel = student.eligible ? 'ELIGIBLE' : 'NOT YET ELIGIBLE';
	const text = `TOTAL: ${student.total.toFixed(1)} / 6.0   ·   ${eligLabel}`;
	drawText(page, text, MARGIN + 14, y - 23, 14, fonts.bold, WHITE);
	return y - h - 14;
}

function drawRegents(
	page: PDFPage,
	fonts: FontPair,
	y: number,
	regents: readonly RegentsRow[],
): number {
	drawText(page, 'Regents Exams', MARGIN, y, 11, fonts.bold, NAVY);
	let cursor = y - 14;
	if (regents.length === 0) {
		drawText(page, '— none on file —', MARGIN, cursor, 9, fonts.regular, MUTED);
		return cursor - 14;
	}
	for (const r of regents.slice(0, 4)) {
		const line = `${r.exam}: ${r.score} (${regentsLevel(r.score, r.safetyNet)}) · ${ymd(r.examDate)}`;
		drawText(page, clip(fonts.regular, line, 9, PAGE_W - MARGIN * 2), MARGIN, cursor, 9, fonts.regular);
		cursor -= 12;
	}
	return cursor - 4;
}

function drawEnrollment(
	page: PDFPage,
	fonts: FontPair,
	y: number,
	enrollment: readonly EnrollmentRow[],
): number {
	drawText(
		page,
		'Course Enrollment (counts toward 1a/1d/2c)',
		MARGIN,
		y,
		11,
		fonts.bold,
		NAVY,
	);
	let cursor = y - 14;
	const cols = [
		{ label: 'Code', x: MARGIN, w: 70 },
		{ label: 'Title', x: MARGIN + 75, w: 280 },
		{ label: 'Year', x: MARGIN + 360, w: 70 },
		{ label: 'Grade', x: MARGIN + 435, w: 40 },
		{ label: 'Credit', x: MARGIN + 480, w: 60 },
	];
	for (const col of cols) {
		drawText(page, col.label, col.x, cursor, 8, fonts.bold, MUTED);
	}
	cursor -= 11;
	if (enrollment.length === 0) {
		drawText(page, '— no enrollment rows —', MARGIN, cursor, 9, fonts.regular, MUTED);
		return cursor - 14;
	}
	for (const e of enrollment.slice(0, 4)) {
		drawText(page, clip(fonts.regular, e.courseCode, 9, cols[0]!.w), cols[0]!.x, cursor, 9, fonts.regular);
		drawText(page, clip(fonts.regular, e.courseTitle, 9, cols[1]!.w), cols[1]!.x, cursor, 9, fonts.regular);
		drawText(page, clip(fonts.regular, e.schoolYear, 9, cols[2]!.w), cols[2]!.x, cursor, 9, fonts.regular);
		drawText(page, clip(fonts.regular, e.finalGrade, 9, cols[3]!.w), cols[3]!.x, cursor, 9, fonts.regular);
		drawText(page, clip(fonts.regular, e.creditStatus, 9, cols[4]!.w), cols[4]!.x, cursor, 9, fonts.regular);
		cursor -= 12;
	}
	return cursor - 4;
}

function drawAuditExcerpt(
	page: PDFPage,
	fonts: FontPair,
	y: number,
	auditExcerpt: readonly AuditRow[],
): number {
	drawText(page, 'Audit excerpt (most recent 10)', MARGIN, y, 11, fonts.bold, NAVY);
	let cursor = y - 14;
	const last10 = auditExcerpt.slice(-10);
	if (last10.length === 0) {
		drawText(page, '— no audit rows —', MARGIN, cursor, 9, fonts.regular, MUTED);
		return cursor - 12;
	}
	for (const a of last10) {
		const line = `${ymd(a.occurredAt)} · ${a.action} · ${a.actorKind} → ${a.targetType}/${a.targetId}`;
		drawText(page, clip(fonts.regular, line, 8, PAGE_W - MARGIN * 2), MARGIN, cursor, 8, fonts.regular);
		cursor -= 10;
	}
	return cursor - 4;
}

function drawFooter(page: PDFPage, fonts: FontPair): void {
	const today = new Date().toISOString().slice(0, 10);
	const text = `Generated ${today}  ·  Source of truth: NYSED Seal of Civic Readiness Manual (Updated March 2025)`;
	drawText(page, text, MARGIN, 24, 8, fonts.regular, MUTED);
}

export async function renderStudentPdf(input: RenderStudentPdfInput): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	doc.setTitle(`Seal of Civic Readiness — ${input.student.firstName} ${input.student.lastName}`);
	doc.setAuthor('GNPS Civic Readiness Portal');
	doc.setSubject('NYSED Seal of Civic Readiness student audit record');

	const fonts: FontPair = {
		regular: await doc.embedFont(StandardFonts.Helvetica),
		bold: await doc.embedFont(StandardFonts.HelveticaBold),
	};

	const page = doc.addPage([PAGE_W, PAGE_H]);

	drawHeaderBar(page, fonts);
	let y = drawStudentBlock(page, fonts, input.student);
	y -= 6;
	y = drawTwoColumnPathways(page, fonts, y, input.student, input.submissions);
	y -= 6;
	y = drawTotalBanner(page, fonts, y, input.student);
	y = drawRegents(page, fonts, y, input.regents);
	y = drawEnrollment(page, fonts, y, input.enrollment);
	y = drawAuditExcerpt(page, fonts, y, input.auditExcerpt);
	drawFooter(page, fonts);

	return await doc.save();
}
