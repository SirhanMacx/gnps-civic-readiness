/**
 * Cohort roster builder — gathers students + their evidence and runs the
 * pathway-rules engine to produce per-student point totals.
 *
 * Used by:
 *   - /admin/+page.server.ts (roster table + metric bar)
 *   - /admin/export/+server.ts (NYSED audit pack zip)
 *
 * Pure server: pulls from Supabase via the service-role client, runs
 * computePoints + isEligible, returns plain objects shaped for the export
 * pipeline (StudentRow / SubmissionRow / RegentsRow / EnrollmentRow).
 *
 * SIS-derived pathways have no `pathway_submissions` row; we infer:
 *   - 1a (four_ss_credits): if student has ≥ 4 'passed' enrollments in
 *     courses whose `counts_for` includes '1a'
 *   - 1d (advanced_ss_course): one per 'passed' enrollment whose course
 *     `counts_for` includes '1d'
 *   - 2c (civic_elective): one per 'passed' enrollment whose course
 *     `counts_for` includes '2c'
 *   - 1b/1c: derived in-engine from regents_scores
 */

import {
  computePoints,
  isEligible,
  type AwardedSubmission,
  type PathwayId,
  type RegentsScore,
  type StudentEvidence
} from '$lib/pathway-rules/index.js';
import type {
  AuditRow,
  EnrollmentRow,
  RegentsRow,
  StudentRow,
  SubmissionRow
} from '$lib/nysed-export/index.js';
import { supabaseAdmin } from './supabase.js';

export interface CohortData {
  students: StudentRow[];
  /** Per-student supporting data, keyed by student id. */
  submissionsByStudent: Map<string, SubmissionRow[]>;
  regentsByStudent: Map<string, RegentsRow[]>;
  enrollmentByStudent: Map<string, EnrollmentRow[]>;
  /** Audit excerpt scoped to this cohort (last N rows). */
  auditExcerpt: AuditRow[];
}

interface DbStudent {
  id: string;
  last_name: string;
  first_name: string;
  grad_year: number;
  status: string;
  accommodations_flag: boolean;
}

interface DbSubmission {
  id: number;
  student_id: string;
  pathway_type: string;
  status: string;
  points_awarded: number | null;
  submitted_at: string | null;
  scored_at: string | null;
  awarded_at: string | null;
}

interface DbRegents {
  student_id: string;
  exam_code: string;
  score: number;
  exam_date: string;
  safety_net_applied: boolean;
}

interface DbEnrollment {
  student_id: string;
  course_id: number;
  school_year: string;
  final_grade: number | null;
  credit_status: string;
}

interface DbCourse {
  id: number;
  course_code: string;
  title: string;
  counts_for: string[];
  credits: number;
}

const MAP_PATHWAY_TYPE_TO_ID: Record<string, PathwayId> = {
  research_project: 'research_project',
  hs_civic_project: 'hs_civic_project',
  service_learning: 'service_learning',
  civic_elective_essay: 'civic_elective',
  wbl_extracurr: 'wbl_extracurr',
  ms_capstone: 'ms_capstone',
  hs_capstone: 'hs_capstone'
};

/**
 * Load every student in a cohort + their evidence, return the typed bundle
 * plus computed point totals / eligibility.
 *
 * @param gradYear pass undefined to include every student.
 */
export async function loadCohort(gradYear?: number): Promise<CohortData> {
  const sb = supabaseAdmin();

  // 1. Students for the cohort.
  const studentQuery = sb
    .from('students')
    .select('id, last_name, first_name, grad_year, status, accommodations_flag')
    .order('last_name', { ascending: true });
  const { data: studentsRaw, error: stuErr } =
    gradYear === undefined
      ? await studentQuery
      : await studentQuery.eq('grad_year', gradYear);
  if (stuErr) {
    throw new Error(`students fetch failed: ${stuErr.message}`);
  }
  const dbStudents = (studentsRaw ?? []) as unknown as DbStudent[];
  const studentIds = dbStudents.map((s) => s.id);

  if (studentIds.length === 0) {
    return {
      students: [],
      submissionsByStudent: new Map(),
      regentsByStudent: new Map(),
      enrollmentByStudent: new Map(),
      auditExcerpt: []
    };
  }

  // 2. Pathway submissions, regents, enrollments, course catalog, audit excerpt.
  const [subRes, regRes, enrRes, catRes, auditRes] = await Promise.all([
    sb
      .from('pathway_submissions')
      .select(
        'id, student_id, pathway_type, status, points_awarded, submitted_at, scored_at, awarded_at'
      )
      .in('student_id', studentIds),
    sb
      .from('regents_scores')
      .select('student_id, exam_code, score, exam_date, safety_net_applied')
      .in('student_id', studentIds),
    sb
      .from('course_enrollment')
      .select('student_id, course_id, school_year, final_grade, credit_status')
      .in('student_id', studentIds),
    sb.from('course_catalog').select('id, course_code, title, counts_for, credits'),
    sb
      .from('audit_log')
      .select('occurred_at, action, actor_kind, target_type, target_id')
      .order('occurred_at', { ascending: false })
      .limit(500)
  ]);

  if (subRes.error) throw new Error(`pathway_submissions fetch failed: ${subRes.error.message}`);
  if (regRes.error) throw new Error(`regents_scores fetch failed: ${regRes.error.message}`);
  if (enrRes.error) throw new Error(`course_enrollment fetch failed: ${enrRes.error.message}`);
  if (catRes.error) throw new Error(`course_catalog fetch failed: ${catRes.error.message}`);

  const dbSubs = (subRes.data ?? []) as unknown as DbSubmission[];
  const dbReg = (regRes.data ?? []) as unknown as DbRegents[];
  const dbEnr = (enrRes.data ?? []) as unknown as DbEnrollment[];
  const dbCat = (catRes.data ?? []) as unknown as DbCourse[];
  const dbAudit = (auditRes.data ?? []) as unknown as {
    occurred_at: string;
    action: string;
    actor_kind: string;
    target_type: string | null;
    target_id: string | null;
  }[];

  const courseById = new Map<number, DbCourse>();
  for (const c of dbCat) courseById.set(c.id, c);

  // 3. Bucket per-student.
  const submissionsByStudent = new Map<string, SubmissionRow[]>();
  const awardedByStudent = new Map<string, AwardedSubmission[]>();
  for (const s of dbSubs) {
    const sr: SubmissionRow = {
      id: String(s.id),
      pathwayType: s.pathway_type,
      status: s.status,
      pointsAwarded: Number(s.points_awarded ?? 0),
      submittedAt: s.submitted_at ?? '',
      scoredAt: s.scored_at ?? undefined,
      awardedAt: s.awarded_at ?? undefined
    };
    const arr = submissionsByStudent.get(s.student_id) ?? [];
    arr.push(sr);
    submissionsByStudent.set(s.student_id, arr);

    if (s.status === 'awarded' && s.points_awarded !== null) {
      const id = MAP_PATHWAY_TYPE_TO_ID[s.pathway_type];
      if (id) {
        const awarded = awardedByStudent.get(s.student_id) ?? [];
        awarded.push({ pathway: id, points: Number(s.points_awarded) });
        awardedByStudent.set(s.student_id, awarded);
      }
    }
  }

  const regentsByStudent = new Map<string, RegentsRow[]>();
  const regentsForEngine = new Map<string, RegentsScore[]>();
  for (const r of dbReg) {
    const row: RegentsRow = {
      exam: r.exam_code,
      score: r.score,
      examDate: r.exam_date,
      safetyNet: r.safety_net_applied
    };
    const arr = regentsByStudent.get(r.student_id) ?? [];
    arr.push(row);
    regentsByStudent.set(r.student_id, arr);

    if (r.exam_code === 'GLOBAL_II' || r.exam_code === 'US_HISTORY') {
      const earr = regentsForEngine.get(r.student_id) ?? [];
      earr.push({
        exam: r.exam_code as 'GLOBAL_II' | 'US_HISTORY',
        score: r.score,
        safetyNet: r.safety_net_applied
      });
      regentsForEngine.set(r.student_id, earr);
    }
  }

  // 4. Build enrollment rows + count SIS-derived pathway evidence.
  const enrollmentByStudent = new Map<string, EnrollmentRow[]>();
  const ssCreditsPassedByStudent = new Map<string, number>();
  const advancedSsCountByStudent = new Map<string, number>();
  const civicElectivePassedByStudent = new Map<string, number>();

  for (const e of dbEnr) {
    const course = courseById.get(e.course_id);
    if (!course) continue;
    const row: EnrollmentRow = {
      courseCode: course.course_code,
      courseTitle: course.title,
      schoolYear: e.school_year,
      finalGrade: e.final_grade !== null ? String(e.final_grade) : '',
      creditStatus: e.credit_status
    };
    const arr = enrollmentByStudent.get(e.student_id) ?? [];
    arr.push(row);
    enrollmentByStudent.set(e.student_id, arr);

    if (e.credit_status === 'passed') {
      const counts = course.counts_for ?? [];
      if (counts.includes('1a')) {
        ssCreditsPassedByStudent.set(
          e.student_id,
          (ssCreditsPassedByStudent.get(e.student_id) ?? 0) + Number(course.credits ?? 1)
        );
      }
      if (counts.includes('1d')) {
        advancedSsCountByStudent.set(
          e.student_id,
          (advancedSsCountByStudent.get(e.student_id) ?? 0) + 1
        );
      }
      if (counts.includes('2c')) {
        civicElectivePassedByStudent.set(
          e.student_id,
          (civicElectivePassedByStudent.get(e.student_id) ?? 0) + 1
        );
      }
    }
  }

  // 5. Compute per-student point totals.
  const students: StudentRow[] = dbStudents.map((s) => {
    const awarded = awardedByStudent.get(s.id) ?? [];

    // 2c rule (spec §4.2): civic_elective awards 0.5 only when there is a
    // matching course-grade-passed AND a civic_elective_essay submission for
    // the same year. We approximate by pairing the count of passed 2c
    // courses with the count of civic_elective_essay awarded essays — take
    // the min. The pathway-rules engine handles 2c through `awarded[]`, so we
    // stuff the synthetic instances in there.
    const electiveProf = civicElectivePassedByStudent.get(s.id) ?? 0;
    const electiveEssaysAwarded = awarded.filter((a) => a.pathway === 'civic_elective').length;
    const electivePairs = Math.min(electiveProf, electiveEssaysAwarded);
    const electiveExcessEssays = electiveEssaysAwarded - electivePairs;
    // Strip extra civic_elective entries that don't have a matching course.
    const filteredAwarded = (() => {
      let toDrop = electiveExcessEssays;
      const out: AwardedSubmission[] = [];
      for (const a of awarded) {
        if (a.pathway === 'civic_elective' && toDrop > 0) {
          toDrop -= 1;
          continue;
        }
        out.push(a);
      }
      return out;
    })();

    const evidence: StudentEvidence = {
      ssCreditsPassed: ssCreditsPassedByStudent.get(s.id) ?? 0,
      regents: regentsForEngine.get(s.id) ?? [],
      advancedSsCount: advancedSsCountByStudent.get(s.id) ?? 0,
      awarded: filteredAwarded
    };
    const totals = computePoints(evidence);
    const eligible = isEligible(totals);

    return {
      id: s.id,
      lastName: s.last_name,
      firstName: s.first_name,
      gradYear: s.grad_year,
      status: s.status,
      knowledge: round1(totals.knowledge),
      participation: round1(totals.participation),
      total: round1(totals.total),
      eligible,
      awardedAt: undefined
    };
  });

  // Pull awardedAt from any "awarded"-status pathway_submissions row when the
  // student.status is itself "awarded". (For Phase 1 Wave 1 the
  // pathway-submissions awardedAt is the closest signal.)
  for (const s of students) {
    if (s.status === 'awarded') {
      const subs = submissionsByStudent.get(s.id) ?? [];
      const latest = subs
        .map((sub) => sub.awardedAt)
        .filter((t): t is string => Boolean(t))
        .sort();
      if (latest.length > 0) s.awardedAt = latest[latest.length - 1];
    }
  }

  const auditExcerpt: AuditRow[] = dbAudit.map((a) => ({
    occurredAt: a.occurred_at,
    action: a.action,
    actorKind: a.actor_kind,
    targetType: a.target_type ?? '',
    targetId: a.target_id ?? ''
  }));

  return { students, submissionsByStudent, regentsByStudent, enrollmentByStudent, auditExcerpt };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
