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
import { sql } from './db.js';
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
  // Direct-Postgres facade doesn't support embedded joins; use raw SQL so
  // we can pull catalog columns alongside the enrollment row in one query.
  const enrRaw = await sql()<
    {
      student_id: string;
      course_id: number;
      school_year: string;
      final_grade: number | null;
      credit_status: string;
      course_code: string | null;
      title: string | null;
      credits: number | string | null;
      counts_for: string[] | null;
    }[]
  >`
    select
      ce.student_id,
      ce.course_id,
      ce.school_year,
      ce.final_grade,
      ce.credit_status,
      cc.course_code,
      cc.title,
      cc.credits,
      cc.counts_for
    from course_enrollment ce
    inner join course_catalog cc on cc.id = ce.course_id
    where ce.student_id = ${studentId}
  `;
  const enrollment: EnrollmentRow[] = enrRaw.map((r) => ({
    courseCode: r.course_code ?? '',
    title: r.title ?? '',
    schoolYear: r.school_year,
    finalGrade: r.final_grade,
    creditStatus: r.credit_status,
    countsFor: (r.counts_for ?? []) as string[],
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
    enrollments: enrRaw.map((r) => ({
      student_id: studentId,
      course_id: r.course_id,
      credit_status: r.credit_status as 'passed' | 'failed' | 'in_progress',
      catalog_credits: Number(r.credits ?? 0),
      catalog_counts_for: (r.counts_for ?? []) as string[],
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
  //    or targeting one of their pathway_submissions rows. The OR-of-AND
  //    predicate doesn't fit the simple builder; use raw SQL.
  const submissionIds = subs.map((s) => String(s.id));
  type AuditDbRow = {
    id: number;
    occurred_at: string;
    actor_kind: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    data: unknown;
  };
  let auditRaw: AuditDbRow[] = [];
  try {
    if (submissionIds.length > 0) {
      auditRaw = (await sql()<AuditDbRow[]>`
        select id, occurred_at, actor_kind, action, target_type, target_id, data
        from audit_log
        where (target_type = 'students' and target_id = ${studentId})
           or (target_type = 'pathway_submissions' and target_id = ANY(${submissionIds}))
        order by occurred_at desc
        limit 20
      `) as unknown as AuditDbRow[];
    } else {
      auditRaw = (await sql()<AuditDbRow[]>`
        select id, occurred_at, actor_kind, action, target_type, target_id, data
        from audit_log
        where target_type = 'students' and target_id = ${studentId}
        order by occurred_at desc
        limit 20
      `) as unknown as AuditDbRow[];
    }
  } catch (e) {
    // Audit log query failures shouldn't 500 the whole detail page.
    console.warn(
      `[getStudentDetail] audit_log query failed: ${e instanceof Error ? e.message : String(e)}`
    );
    auditRaw = [];
  }
  const auditLog: AuditLogRow[] = auditRaw.map((r) => ({
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
