/**
 * Counselor cohort roster — assembles per-student point totals.
 *
 * Joins:
 *   students × course_enrollment × course_catalog × regents_scores × pathway_submissions(status='awarded')
 *
 * For each student, builds a `StudentEvidence` (from @gnps-civic/pathway-rules)
 * and runs `computePoints` + `isEligible` to produce roster-ready columns:
 *
 *   { studentId, lastName, firstName, gradYear, status, knowledge, participation,
 *     total, eligible, awardedAt? }
 *
 * SIS-derived pathway translation (spec §4.2 + §4.3):
 *   - 1a: ssCreditsPassed   = sum of course_enrollment.credits where credit_status='passed'
 *                              AND course_catalog.counts_for ⊇ ['1a']
 *   - 1b/1c: regents[]      = regents_scores rows joined to student
 *   - 1d: advancedSsCount   = count of course_enrollment rows where credit_status='passed'
 *                              AND course_catalog.counts_for ⊇ ['1d']
 *   - awarded[]: status='awarded' pathway_submissions, with points_awarded
 *
 * The query batches per-table reads and joins client-side. We keep the
 * query small (≤ ~5 tables, no recursive joins) — Phase 1 cohorts are
 * small enough that an N+1 isn't worth optimizing past this.
 */

import {
  computePoints,
  isEligible,
  type AwardedSubmission,
  type PathwayId,
  type RegentsScore,
  type StudentEvidence,
} from '$lib/pathway-rules/index.js';
import { supabaseAdmin } from './supabase.js';

export type RosterStatus =
  | 'awarded'
  | 'eligible'
  | 'needs_knowledge'
  | 'needs_participation'
  | 'needs_both'
  | 'in_progress';

export interface RosterRow {
  studentId: string;
  lastName: string;
  firstName: string;
  gradYear: number;
  status: RosterStatus;
  /** Cumulative knowledge column points (after pathway caps applied). */
  knowledge: number;
  /** Cumulative participation column points (after pathway caps applied). */
  participation: number;
  /** Sum of knowledge + participation. */
  total: number;
  /** True when knowledge ≥ 2 AND participation ≥ 2 AND total ≥ 6. */
  eligible: boolean;
  /** ISO timestamp if any pathway_submission has status='awarded'. */
  awardedAt?: string;
  /** Underlying student-status enum (active|awarded|withdrawn|graduated_without_seal). */
  studentStatus: string;
}

interface StudentRow {
  id: string;
  last_name: string;
  first_name: string;
  grad_year: number;
  status: string;
  counselor_id: string | null;
}

interface EnrollmentRow {
  student_id: string;
  course_id: number;
  credit_status: 'passed' | 'failed' | 'in_progress';
  /** Joined from course_catalog. */
  catalog_credits: number;
  catalog_counts_for: string[];
}

interface RegentsRow {
  student_id: string;
  exam_code: 'GLOBAL_II' | 'US_HISTORY';
  score: number;
  safety_net_applied: boolean;
}

interface AwardedRow {
  student_id: string;
  pathway_type: string;
  points_awarded: number | null;
  awarded_at: string | null;
}

/**
 * Determine the rollup status pill for a roster row.
 *
 * - 'awarded'              — student.status == 'awarded' (counselor confirmed)
 * - 'eligible'             — totals satisfy all three thresholds, awaiting confirm
 * - 'needs_knowledge'      — knowledge < 2 (and participation ≥ 2)
 * - 'needs_participation'  — participation < 2 (and knowledge ≥ 2)
 * - 'needs_both'           — both columns < 2
 * - 'in_progress'          — partial progress (one column at threshold, total < 6)
 */
function computeStatus(args: {
  knowledge: number;
  participation: number;
  total: number;
  studentStatus: string;
}): RosterStatus {
  if (args.studentStatus === 'awarded') return 'awarded';
  if (args.knowledge >= 2 && args.participation >= 2 && args.total >= 6) {
    return 'eligible';
  }
  const lowK = args.knowledge < 2;
  const lowP = args.participation < 2;
  if (lowK && lowP) return 'needs_both';
  if (lowK) return 'needs_knowledge';
  if (lowP) return 'needs_participation';
  return 'in_progress';
}

/**
 * The set of pathway_type values that map cleanly to PathwayId in the rules
 * package. The DB enum has historically used `civic_elective_essay` while the
 * rules package keys it as `civic_elective`; we translate at the boundary.
 */
const PATHWAY_TYPE_TO_ID: Record<string, PathwayId> = {
  research_project: 'research_project',
  hs_civic_project: 'hs_civic_project',
  service_learning: 'service_learning',
  civic_elective_essay: 'civic_elective',
  ms_capstone: 'ms_capstone',
  wbl_extracurr: 'wbl_extracurr',
  hs_capstone: 'hs_capstone',
};

export async function getCohortRoster(opts: {
  counselorId?: string;
} = {}): Promise<RosterRow[]> {
  const sb = supabaseAdmin();

  // 1) students (optionally filtered by caseload)
  let studentsQuery = sb
    .from('students')
    .select('id, last_name, first_name, grad_year, status, counselor_id')
    .order('last_name', { ascending: true });

  if (opts.counselorId) {
    studentsQuery = studentsQuery.eq('counselor_id', opts.counselorId);
  }

  const { data: studentsRaw, error: eStu } = await studentsQuery;
  if (eStu) throw new Error(`students.select failed: ${eStu.message}`);
  const students = (studentsRaw ?? []) as StudentRow[];
  if (students.length === 0) return [];

  const studentIds = students.map((s) => s.id);

  // 2) course_enrollment + course_catalog (only `passed` and `in_progress`
  //    are interesting for current credits; we pass them all through and let
  //    the rule engine ignore the rest).
  const { data: enrollRaw, error: eEnr } = await sb
    .from('course_enrollment')
    .select(
      'student_id, course_id, credit_status, course_catalog!inner(credits, counts_for)',
    )
    .in('student_id', studentIds);
  if (eEnr) throw new Error(`course_enrollment.select failed: ${eEnr.message}`);
  const enrollments: EnrollmentRow[] = (enrollRaw ?? []).map((row: any) => ({
    student_id: row.student_id,
    course_id: row.course_id,
    credit_status: row.credit_status,
    catalog_credits: Number(row.course_catalog?.credits ?? 0),
    catalog_counts_for: (row.course_catalog?.counts_for ?? []) as string[],
  }));

  // 3) regents_scores
  const { data: regentsRaw, error: eReg } = await sb
    .from('regents_scores')
    .select('student_id, exam_code, score, safety_net_applied')
    .in('student_id', studentIds);
  if (eReg) throw new Error(`regents_scores.select failed: ${eReg.message}`);
  const regents = (regentsRaw ?? []) as RegentsRow[];

  // 4) awarded submissions
  const { data: awardedRaw, error: eAw } = await sb
    .from('pathway_submissions')
    .select('student_id, pathway_type, points_awarded, awarded_at')
    .eq('status', 'awarded')
    .in('student_id', studentIds);
  if (eAw) throw new Error(`pathway_submissions.select failed: ${eAw.message}`);
  const awarded = (awardedRaw ?? []) as AwardedRow[];

  // Group helpers
  const enrollByStudent = new Map<string, EnrollmentRow[]>();
  for (const e of enrollments) {
    const list = enrollByStudent.get(e.student_id);
    if (list) list.push(e);
    else enrollByStudent.set(e.student_id, [e]);
  }
  const regentsByStudent = new Map<string, RegentsRow[]>();
  for (const r of regents) {
    const list = regentsByStudent.get(r.student_id);
    if (list) list.push(r);
    else regentsByStudent.set(r.student_id, [r]);
  }
  const awardedByStudent = new Map<string, AwardedRow[]>();
  for (const a of awarded) {
    const list = awardedByStudent.get(a.student_id);
    if (list) list.push(a);
    else awardedByStudent.set(a.student_id, [a]);
  }

  return students.map((s) => {
    const evidence = buildStudentEvidence({
      enrollments: enrollByStudent.get(s.id) ?? [],
      regents: regentsByStudent.get(s.id) ?? [],
      awarded: awardedByStudent.get(s.id) ?? [],
    });
    const totals = computePoints(evidence);
    const eligible = isEligible(totals);

    const latestAwarded = (awardedByStudent.get(s.id) ?? [])
      .map((a) => a.awarded_at)
      .filter((d): d is string => !!d)
      .sort()
      .pop();

    return {
      studentId: s.id,
      lastName: s.last_name,
      firstName: s.first_name,
      gradYear: s.grad_year,
      knowledge: totals.knowledge,
      participation: totals.participation,
      total: totals.total,
      eligible,
      awardedAt: latestAwarded,
      studentStatus: s.status,
      status: computeStatus({
        knowledge: totals.knowledge,
        participation: totals.participation,
        total: totals.total,
        studentStatus: s.status,
      }),
    };
  });
}

/**
 * Translate raw SIS rows + awarded submissions into the StudentEvidence shape
 * expected by @gnps-civic/pathway-rules.
 */
export function buildStudentEvidence(args: {
  enrollments: readonly EnrollmentRow[];
  regents: readonly RegentsRow[];
  awarded: readonly AwardedRow[];
}): StudentEvidence {
  // 1a — sum credits for courses tagged '1a' that the student passed.
  let ssCreditsPassed = 0;
  let advancedSsCount = 0;
  for (const e of args.enrollments) {
    if (e.credit_status !== 'passed') continue;
    if (e.catalog_counts_for.includes('1a')) {
      ssCreditsPassed += e.catalog_credits;
    }
    if (e.catalog_counts_for.includes('1d')) {
      advancedSsCount += 1;
    }
  }

  const regents: RegentsScore[] = args.regents.map((r) => ({
    exam: r.exam_code,
    score: r.score,
    safetyNet: r.safety_net_applied,
  }));

  const awardedTransformed: AwardedSubmission[] = [];
  for (const a of args.awarded) {
    const id = PATHWAY_TYPE_TO_ID[a.pathway_type];
    if (!id) continue;
    awardedTransformed.push({
      pathway: id,
      points: Number(a.points_awarded ?? 0),
    });
  }

  return {
    ssCreditsPassed,
    regents,
    advancedSsCount,
    awarded: awardedTransformed,
  };
}
