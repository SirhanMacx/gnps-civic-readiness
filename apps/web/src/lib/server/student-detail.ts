/**
 * Per-student deep view for the counselor portal.
 *
 * Returns everything the /counselor/student/[id] page needs to render:
 *   - student record
 *   - knowledge / participation / total totals + eligibility flag
 *   - awarded pathway_submissions (with award date + points)
 *   - pending pathway_submissions (status ∈ {submitted, scored, in_progress, proposed, topic_approved})
 *   - regents scores
 *   - course enrollment (the rows that drive 1a / 1d / 2c)
 *   - audit log excerpt (last 20 entries scoped to this student or their submissions)
 */

import { computePoints, isEligible, type PointTotals } from '$lib/pathway-rules/index.js';
import { buildStudentEvidence } from './roster.js';
import { supabaseAdmin } from './supabase.js';

export interface StudentRecord {
  id: string;
  lastName: string;
  firstName: string;
  gradYear: number;
  status: string;
  accommodationsFlag: boolean;
  counselorId: string | null;
  createdAt: string;
}

export interface AwardedPathwayRow {
  submissionId: number;
  pathwayType: string;
  pointsAwarded: number;
  awardedAt: string | null;
  notes: string | null;
}

export interface PendingPathwayRow {
  submissionId: number;
  pathwayType: string;
  status: string;
  submittedAt: string | null;
  proposedAt: string | null;
  scoredAt: string | null;
  domainTags: string[];
  proposalSummary: string | null;
}

export interface RegentsRow {
  examCode: string;
  score: number;
  examDate: string;
  safetyNetApplied: boolean;
}

export interface EnrollmentRow {
  courseCode: string;
  title: string;
  schoolYear: string;
  finalGrade: number | null;
  creditStatus: string;
  countsFor: string[];
}

export interface AuditLogRow {
  id: number;
  occurredAt: string;
  actorKind: string;
  action: string;
  data: unknown;
}

export interface StudentDetail {
  student: StudentRecord;
  knowledge: number;
  participation: number;
  total: number;
  eligible: boolean;
  totals: PointTotals;
  awardedSubmissions: AwardedPathwayRow[];
  pendingSubmissions: PendingPathwayRow[];
  regents: RegentsRow[];
  enrollment: EnrollmentRow[];
  auditLog: AuditLogRow[];
}

const PENDING_STATUSES = [
  'draft',
  'proposed',
  'topic_approved',
  'in_progress',
  'submitted',
  'scored',
];

export async function getStudentDetail(studentId: string): Promise<StudentDetail | null> {
  const sb = supabaseAdmin();

  // 1) Student
  const { data: stu, error: eStu } = await sb
    .from('students')
    .select('id, last_name, first_name, grad_year, status, accommodations_flag, counselor_id, created_at')
    .eq('id', studentId)
    .maybeSingle();
  if (eStu) throw new Error(`students.select failed: ${eStu.message}`);
  if (!stu) return null;

  // 2) Course enrollment + course_catalog
  const { data: enrRaw, error: eEnr } = await sb
    .from('course_enrollment')
    .select(
      'student_id, course_id, school_year, term, final_grade, credit_status, ' +
      'course_catalog!inner(course_code, title, credits, counts_for)',
    )
    .eq('student_id', studentId);
  if (eEnr) throw new Error(`course_enrollment.select failed: ${eEnr.message}`);
  const enrollment: EnrollmentRow[] = (enrRaw ?? []).map((r: any) => ({
    courseCode: r.course_catalog?.course_code ?? '',
    title: r.course_catalog?.title ?? '',
    schoolYear: r.school_year,
    finalGrade: r.final_grade,
    creditStatus: r.credit_status,
    countsFor: (r.course_catalog?.counts_for ?? []) as string[],
  }));

  // 3) Regents scores
  const { data: regRaw, error: eReg } = await sb
    .from('regents_scores')
    .select('exam_code, score, exam_date, safety_net_applied')
    .eq('student_id', studentId)
    .order('exam_date', { ascending: false });
  if (eReg) throw new Error(`regents_scores.select failed: ${eReg.message}`);
  const regents: RegentsRow[] = (regRaw ?? []).map((r: any) => ({
    examCode: r.exam_code,
    score: r.score,
    examDate: r.exam_date,
    safetyNetApplied: r.safety_net_applied,
  }));

  // 4) All pathway_submissions for this student
  const { data: subsRaw, error: eSub } = await sb
    .from('pathway_submissions')
    .select(
      'id, pathway_type, status, points_awarded, awarded_at, submitted_at, proposed_at, ' +
        'scored_at, notes, domain_tags, proposal_data',
    )
    .eq('student_id', studentId)
    .order('id', { ascending: false });
  if (eSub) throw new Error(`pathway_submissions.select failed: ${eSub.message}`);
  const subs = ((subsRaw ?? []) as unknown) as Array<{
    id: number;
    pathway_type: string;
    status: string;
    points_awarded: number | null;
    awarded_at: string | null;
    submitted_at: string | null;
    proposed_at: string | null;
    scored_at: string | null;
    notes: string | null;
    domain_tags: string[];
    proposal_data: Record<string, unknown> | null;
  }>;

  const awardedSubmissions: AwardedPathwayRow[] = subs
    .filter((s) => s.status === 'awarded')
    .map((s) => ({
      submissionId: s.id,
      pathwayType: s.pathway_type,
      pointsAwarded: Number(s.points_awarded ?? 0),
      awardedAt: s.awarded_at,
      notes: s.notes,
    }));

  const pendingSubmissions: PendingPathwayRow[] = subs
    .filter((s) => PENDING_STATUSES.includes(s.status))
    .map((s) => ({
      submissionId: s.id,
      pathwayType: s.pathway_type,
      status: s.status,
      submittedAt: s.submitted_at,
      proposedAt: s.proposed_at,
      scoredAt: s.scored_at,
      domainTags: s.domain_tags ?? [],
      proposalSummary:
        (s.proposal_data && typeof s.proposal_data === 'object'
          ? (s.proposal_data as Record<string, unknown>).issue_identified ??
            (s.proposal_data as Record<string, unknown>).course_code ??
            null
          : null) as string | null,
    }));

  // 5) Compute totals using the pathway-rules engine.
  const evidence = buildStudentEvidence({
    enrollments: (enrRaw ?? []).map((r: any) => ({
      student_id: studentId,
      course_id: r.course_id,
      credit_status: r.credit_status,
      catalog_credits: Number(r.course_catalog?.credits ?? 0),
      catalog_counts_for: (r.course_catalog?.counts_for ?? []) as string[],
    })),
    regents: regents.map((r) => ({
      student_id: studentId,
      exam_code: r.examCode as 'GLOBAL_II' | 'US_HISTORY',
      score: r.score,
      safety_net_applied: r.safetyNetApplied,
    })),
    awarded: awardedSubmissions.map((a) => ({
      student_id: studentId,
      pathway_type: a.pathwayType,
      points_awarded: a.pointsAwarded,
      awarded_at: a.awardedAt,
    })),
  });

  const totals = computePoints(evidence);

  // 6) Audit log — pull last 20 entries either targeting the student directly,
  //    or targeting one of their pathway_submissions rows.
  const submissionIds = subs.map((s) => String(s.id));
  let logQuery = sb
    .from('audit_log')
    .select('id, occurred_at, actor_kind, action, target_type, target_id, data')
    .order('occurred_at', { ascending: false })
    .limit(20);

  if (submissionIds.length > 0) {
    // Either student directly OR a submission row owned by them.
    logQuery = logQuery.or(
      `and(target_type.eq.students,target_id.eq.${studentId}),` +
        `and(target_type.eq.pathway_submissions,target_id.in.(${submissionIds.join(',')}))`,
    );
  } else {
    logQuery = logQuery
      .eq('target_type', 'students')
      .eq('target_id', studentId);
  }

  const { data: auditRaw, error: eLog } = await logQuery;
  if (eLog) {
    // Audit log query failures shouldn't 500 the whole detail page.
    console.warn(`[getStudentDetail] audit_log query failed: ${eLog.message}`);
  }
  const auditLog: AuditLogRow[] = (auditRaw ?? []).map((r: any) => ({
    id: r.id,
    occurredAt: r.occurred_at,
    actorKind: r.actor_kind,
    action: r.action,
    data: r.data,
  }));

  const studentRec: StudentRecord = {
    id: stu.id as string,
    lastName: stu.last_name as string,
    firstName: stu.first_name as string,
    gradYear: stu.grad_year as number,
    status: stu.status as string,
    accommodationsFlag: !!stu.accommodations_flag,
    counselorId: (stu.counselor_id as string | null) ?? null,
    createdAt: stu.created_at as string,
  };

  return {
    student: studentRec,
    knowledge: totals.knowledge,
    participation: totals.participation,
    total: totals.total,
    eligible: isEligible(totals),
    totals,
    awardedSubmissions,
    pendingSubmissions,
    regents,
    enrollment,
    auditLog,
  };
}
