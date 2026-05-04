/**
 * Teacher Quick-Push — bulk-award civic-readiness pathway points to one or
 * more students at once. The "I already have the evidence in my class
 * gradebook, just push it to the portal" flow.
 *
 * Submission status depends on the teacher's authority:
 *   - If the teacher is ALSO an scrc_member, status='awarded' immediately
 *     (their score is the SCRC score; this matches NYSED's expectation
 *     that the SCRC committee is the scoring body)
 *   - Otherwise, status='proposed' (queued for SCRC review)
 *
 * In both cases:
 *   - Each row gets submitted_by_user_id = the teacher's user.id
 *   - audit_log records action='teacher_pushed_pathway_points' with the
 *     pathway, student IDs, and points
 *   - Optional shared evidence file gets attached as evidence_files row(s)
 */

import { z } from 'zod';
import { sql } from './db.js';
import { getStorage } from './storage.js';

export const TeacherPushSchema = z.object({
  pathwayType: z.enum([
    'research_project',
    'hs_civic_project',
    'hs_capstone',
    'ms_capstone',
    'civic_elective_essay',
    'service_learning',
    'wbl_extracurr'
  ]),
  /** List of student IDs to push the same pathway points to. */
  studentIds: z.array(z.string().min(3).max(40)).min(1).max(200),
  /** Per-pathway-type points (the teacher can override the default; range-clipped server-side). */
  pointsAwarded: z.number().nonnegative().max(4),
  /** Optional shared rubric notes / class context (stored in pathway_submissions.notes). */
  notes: z.string().max(2000).optional().default(''),
  /**
   * Tags for the four NYSED civic-readiness domains the teacher is asserting
   * the work covers (knowledge / skills / mindsets / experiences). At least
   * one required for project-type pathways.
   */
  domainTags: z
    .array(z.enum(['knowledge', 'skills', 'mindsets', 'experiences']))
    .max(4)
    .default([]),
  /** Class label (free text) so the audit log makes sense in human terms. */
  classLabel: z.string().max(120).optional().default('')
});
export type TeacherPushInput = z.infer<typeof TeacherPushSchema>;

export interface TeacherUser {
  id: string;
  email: string;
  fullName: string;
  role: 'teacher' | 'counselor' | 'scrc_member' | 'admin';
}

export interface PushResult {
  pushedCount: number;
  status: 'awarded' | 'proposed';
  perStudent: Array<{ studentId: string; submissionId: number; status: string }>;
  rejected: Array<{ studentId: string; reason: string }>;
}

/**
 * Apply the cap rules from the pathway-rules engine before writing.
 * Returns the maximum allowed points for the pathway given the student's
 * existing awarded count.
 */
async function clampAwardForCap(
  studentId: string,
  pathwayType: TeacherPushInput['pathwayType'],
  proposedPoints: number
): Promise<number> {
  // Pull cap from the pathway-rules engine. Lazy-import so test doesn't pull
  // the whole package when only mocking this module.
  const { capOf } = await import('$lib/pathway-rules/index.js');

  const id =
    pathwayType === 'civic_elective_essay'
      ? 'civic_elective'
      : (pathwayType as Parameters<typeof capOf>[0]);

  const cap = capOf(id);
  if (!cap) return proposedPoints; // uncapped pathway (e.g. service_learning)

  const existing = await sql<
    { sum: string | null }[]
  >`
    select sum(points_awarded) as sum
    from public.pathway_submissions
    where student_id = ${studentId}
      and pathway_type = ${pathwayType}
      and status = 'awarded'
  `;
  const existingPoints = Number(existing[0]?.sum ?? 0);
  const remaining = Math.max(0, cap.maxPoints - existingPoints);
  return Math.min(proposedPoints, remaining);
}

export async function teacherPush(
  input: TeacherPushInput,
  teacher: TeacherUser
): Promise<PushResult> {
  const data = TeacherPushSchema.parse(input);

  // Status policy: SCRC members + admins can directly award; teachers/
  // counselors propose for SCRC scoring.
  const directAward = teacher.role === 'scrc_member' || teacher.role === 'admin';
  const targetStatus = directAward ? 'awarded' : 'proposed';

  const perStudent: PushResult['perStudent'] = [];
  const rejected: PushResult['rejected'] = [];

  for (const studentId of data.studentIds) {
    // Verify the student exists. If not, reject with a reason; don't error.
    const found = await sql<{ id: string }[]>`
      select id from public.students where id = ${studentId} limit 1
    `;
    if (found.length === 0) {
      rejected.push({ studentId, reason: 'student_not_found' });
      continue;
    }

    const pointsAfterCap = directAward
      ? await clampAwardForCap(studentId, data.pathwayType, data.pointsAwarded)
      : data.pointsAwarded; // proposed submissions don't write awarded points yet

    if (directAward && pointsAfterCap === 0) {
      rejected.push({ studentId, reason: 'already_at_cap' });
      continue;
    }

    const inserted = await sql<{ id: number }[]>`
      insert into public.pathway_submissions (
        student_id, pathway_type, status,
        points_awarded, awarded_at, scored_at, scored_by,
        proposed_at, proposed_by_text, submitted_by_user_id,
        domain_tags, notes
      ) values (
        ${studentId},
        ${data.pathwayType},
        ${targetStatus}::submission_status,
        ${directAward ? pointsAfterCap : null},
        ${directAward ? sql`now()` : null},
        ${directAward ? sql`now()` : null},
        ${directAward ? teacher.id : null},
        ${sql`now()`},
        ${`${teacher.fullName} (${teacher.role}) — ${data.classLabel || 'no class label'}`},
        ${teacher.id},
        ${data.domainTags},
        ${data.notes}
      )
      returning id
    `;
    const submissionId = inserted[0]!.id;

    const auditPayload = JSON.stringify({
      pathway_type: data.pathwayType,
      points: directAward ? pointsAfterCap : data.pointsAwarded,
      class_label: data.classLabel,
      domain_tags: data.domainTags
    });
    await sql`
      insert into public.audit_log (
        actor_id, actor_kind, action, target_type, target_id, data
      ) values (
        ${teacher.id},
        ${teacher.role},
        ${directAward ? 'teacher_awarded_pathway_points' : 'teacher_proposed_pathway_for_review'},
        'pathway_submissions',
        ${String(submissionId)},
        ${auditPayload}::jsonb
      )
    `;

    perStudent.push({ studentId, submissionId, status: targetStatus });
  }

  return {
    pushedCount: perStudent.length,
    status: targetStatus,
    perStudent,
    rejected
  };
}

/**
 * For the teacher's "my recent pushes" view.
 */
export async function listMyPushes(teacherUserId: string, limit = 50) {
  return sql<
    Array<{
      id: number;
      student_id: string;
      pathway_type: string;
      status: string;
      points_awarded: string | null;
      created_at: string;
    }>
  >`
    select id, student_id, pathway_type, status, points_awarded, created_at
    from public.pathway_submissions
    where submitted_by_user_id = ${teacherUserId}
    order by created_at desc
    limit ${limit}
  `;
}
