/**
 * @gnps-civic/nysed-export — shared type definitions
 *
 * These types model the audit-pack inputs the year-end exporter consumes. They
 * intentionally avoid any runtime dependency (no Supabase, no SvelteKit) so the
 * package stays pure TypeScript and trivially unit-testable.
 *
 * Source of truth for field semantics: NYSED Seal of Civic Readiness Manual
 * (Updated 2024) and the portal design spec at
 * docs/superpowers/specs/2026-05-04-gnps-civic-readiness-portal-design.md.
 */

/** A row in roster.csv / awarded_students.csv and the input to the per-student PDF. */
export interface StudentRow {
	/** District-issued student ID (e.g. "GN20271234"). */
	id: string;
	lastName: string;
	firstName: string;
	/** 4-digit graduation year. */
	gradYear: number;
	/**
	 * Workflow status string. Canonical values used by the portal:
	 *   "in_progress" | "ready_for_review" | "awarded" | "not_awarded"
	 * Strings are accepted unchanged so this package stays decoupled from any
	 * enum the SvelteKit app evolves.
	 */
	status: string;
	/** Civic-knowledge subtotal (max 3.0 per NYSED). */
	knowledge: number;
	/** Civic-participation subtotal (max 3.0 per NYSED). */
	participation: number;
	/** knowledge + participation. */
	total: number;
	/** True iff total >= 6 and other Seal eligibility gates pass. */
	eligible: boolean;
	/** ISO timestamp when status flipped to "awarded", if applicable. */
	awardedAt?: string;
}

/** A single pathway submission row included in a student's PDF. */
export interface SubmissionRow {
	id: string;
	/** Pathway type, e.g. "service_learning", "hs_capstone", "civics_course_a". */
	pathwayType: string;
	status: string;
	pointsAwarded: number;
	/** ISO timestamp when the student submitted the evidence. */
	submittedAt: string;
	/** ISO timestamp when SCRC scored the submission, if applicable. */
	scoredAt?: string;
	/** ISO timestamp when counselor confirmed point award, if applicable. */
	awardedAt?: string;
}

/** Regents exam score row (used to surface Mastery / Proficiency / Safety-Net level). */
export interface RegentsRow {
	exam: string;
	score: number;
	examDate: string;
	/**
	 * True iff the student qualified via the Regents safety-net designation
	 * rather than scoring at the Proficiency or Mastery threshold directly.
	 */
	safetyNet: boolean;
}

/** Course enrollment row counting toward Knowledge pathway 1a/1d/2c. */
export interface EnrollmentRow {
	courseCode: string;
	courseTitle: string;
	/** e.g. "2025-2026". */
	schoolYear: string;
	finalGrade: string;
	/** "earned" | "in_progress" | "not_earned" — kept open for forward-compat. */
	creditStatus: string;
}

/** A single audit-log row. */
export interface AuditRow {
	occurredAt: string;
	action: string;
	/** "student" | "supervisor" | "counselor" | "scrc" | "admin" | "system". */
	actorKind: string;
	targetType: string;
	targetId: string;
}

/** A single piece of evidence attached to a student. */
export interface EvidenceFile {
	filename: string;
	mimeType: string;
	sizeBytes: number;
	/** Free-form classifier, e.g. "reflection", "capstone_artifact", "hours_log". */
	kind: string;
	bytes: Uint8Array;
	/**
	 * The four NYSED civic-readiness domains the artifact addresses, drawn from
	 * the canonical set: ["knowledge", "skills", "mindsets", "experiences"].
	 */
	domainTags: string[];
}
