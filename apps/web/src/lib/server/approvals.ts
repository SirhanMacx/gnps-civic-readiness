/**
 * Counselor approval-queue actions.
 *
 * The queue surfaces:
 *   - status='submitted' submissions for hours-pathways (service_learning,
 *     wbl_extracurr) where the student has filed a reflection
 *   - status='scored' submissions for project pathways where SCRC has scored
 *     but the counselor has not yet confirmed the points award
 *
 * Three actions per item:
 *   - approveSubmission   → status='awarded', points_awarded set, awarded_at timestamp,
 *                           audit row 'counselor_approved_submission'
 *   - requestRevision     → status back to 'in_progress', notes appended,
 *                           audit row 'counselor_requested_revision'
 *   - declineSubmission   → status='rejected', notes carries reason,
 *                           audit row 'counselor_declined_submission'
 *
 * All writes go through supabaseAdmin() (service-role; bypasses RLS).
 * All writes are atomic in the sense that we throw with the Supabase error
 * message on any failure — no partial updates that fail to log.
 */

import { PATHWAYS, type PathwayId } from '$lib/pathway-rules/index.js';
import { supabaseAdmin } from './supabase.js';

export interface ApprovalQueueItem {
  submissionId: number;
  studentId: string;
  studentLastName: string;
  studentFirstName: string;
  gradYear: number;
  pathwayType: string;
  status: string;
  submittedAt: string | null;
  scoredAt: string | null;
  /** Default per-instance award (e.g. 1.5 for hs_civic_project) — UI auto-fills this. */
  defaultPoints: number;
  /** Pathway-rules cap (per-pathway), if any. UI shows context. */
  capMaxPoints: number | null;
  /** Short, human-readable claim summary surfaced in the queue. */
  claim: string;
  /** Inline reflection text (first 500 chars of notes / proposal_data.reflection). */
  reflectionExcerpt: string | null;
  reflectionTruncated: boolean;
  /** Hours-pathway specifics (null for project pathways). */
  hoursTotal: number | null;
  hoursConfirmed: boolean | null;
  domainTags: string[];
  evidenceFiles: Array<{
    id: number;
    filename: string;
    storagePath: string;
    kind: string;
  }>;
}

const REFLECTION_EXCERPT_LIMIT = 500;

const PATHWAY_TYPE_TO_ID: Record<string, PathwayId> = {
  research_project: 'research_project',
  hs_civic_project: 'hs_civic_project',
  service_learning: 'service_learning',
  civic_elective_essay: 'civic_elective',
  ms_capstone: 'ms_capstone',
  wbl_extracurr: 'wbl_extracurr',
  hs_capstone: 'hs_capstone',
};

/**
 * Look up the per-instance award (e.g. 1.5 for hs_civic_project).
 * Returns 0 if the pathway_type is not in the registry — UI defaults to 0
 * and asks the counselor to enter a value.
 */
export function defaultPointsFor(pathwayType: string): number {
  const id = PATHWAY_TYPE_TO_ID[pathwayType];
  if (!id) return 0;
  const p = PATHWAYS.find((entry) => entry.id === id);
  return p?.pointsEach ?? 0;
}

/**
 * Look up the per-pathway max-points cap, if defined. Used by the UI to
 * surface "this pathway caps at 3 across all instances" hints.
 */
export function capMaxFor(pathwayType: string): number | null {
  const id = PATHWAY_TYPE_TO_ID[pathwayType];
  if (!id) return null;
  const p = PATHWAYS.find((entry) => entry.id === id);
  return p?.cap?.maxPoints ?? null;
}

interface RawHoursAgg {
  total: number;
  hasUnconfirmed: boolean;
  hasConfirmed: boolean;
  /** Last reflection-style description we found. */
  description: string | null;
  organization: string | null;
}

function summarizeHours(hours: any[]): RawHoursAgg {
  let total = 0;
  let hasUnconfirmed = false;
  let hasConfirmed = false;
  let description: string | null = null;
  let organization: string | null = null;
  for (const h of hours) {
    total += Number(h.hours ?? 0);
    if (h.confirmation_status === 'confirmed') hasConfirmed = true;
    else hasUnconfirmed = true;
    if (h.description && !description) description = h.description as string;
    if (h.organization && !organization) organization = h.organization as string;
  }
  return { total, hasUnconfirmed, hasConfirmed, description, organization };
}

function buildClaim(args: {
  pathwayType: string;
  hours: RawHoursAgg | null;
  proposalData: Record<string, unknown> | null;
}): string {
  if (args.hours) {
    const org = args.hours.organization ? ` at ${args.hours.organization}` : '';
    return `${args.pathwayType.replace(/_/g, ' ')} · ${args.hours.total} hrs${org}`;
  }
  if (args.proposalData) {
    const scope = args.proposalData.scope ?? '';
    const issue = (args.proposalData.issue_identified as string | undefined) ?? '';
    if (issue) {
      const trimmed = issue.length > 80 ? `${issue.slice(0, 80)}…` : issue;
      return `${args.pathwayType.replace(/_/g, ' ')} (${scope}) · ${trimmed}`;
    }
  }
  return args.pathwayType.replace(/_/g, ' ');
}

function buildReflection(args: {
  hours: RawHoursAgg | null;
  proposalData: Record<string, unknown> | null;
  notes: string | null;
}): { excerpt: string | null; truncated: boolean } {
  const candidates: string[] = [];
  if (args.notes) candidates.push(args.notes);
  if (args.hours?.description) candidates.push(args.hours.description);
  if (args.proposalData) {
    if (typeof args.proposalData.civic_experience_plan === 'string') {
      candidates.push(args.proposalData.civic_experience_plan);
    }
    if (typeof args.proposalData.reflection === 'string') {
      candidates.push(args.proposalData.reflection);
    }
  }
  const text = candidates.find((c) => c && c.trim().length > 0) ?? null;
  if (!text) return { excerpt: null, truncated: false };
  const truncated = text.length > REFLECTION_EXCERPT_LIMIT;
  return {
    excerpt: truncated ? text.slice(0, REFLECTION_EXCERPT_LIMIT) : text,
    truncated,
  };
}

export async function listApprovalQueue(opts: {
  counselorId?: string;
} = {}): Promise<ApprovalQueueItem[]> {
  const sb = supabaseAdmin();

  // Pull pathway_submissions in 'submitted' or 'scored' status, joined to students.
  let query = sb
    .from('pathway_submissions')
    .select(
      'id, student_id, pathway_type, status, submitted_at, scored_at, notes, ' +
        'domain_tags, proposal_data, ' +
        'students!inner(id, last_name, first_name, grad_year, counselor_id)',
    )
    .in('status', ['submitted', 'scored'])
    .order('submitted_at', { ascending: true });

  if (opts.counselorId) {
    query = query.eq('students.counselor_id', opts.counselorId);
  }

  const { data: subsRaw, error: eSub } = await query;
  if (eSub) throw new Error(`pathway_submissions.select failed: ${eSub.message}`);
  const subs = (subsRaw ?? []) as Array<any>;
  if (subs.length === 0) return [];

  const submissionIds = subs.map((s) => s.id as number);

  // Pull associated hours_log rows (only relevant for hours-pathways).
  const { data: hoursRaw, error: eHrs } = await sb
    .from('hours_log')
    .select('submission_id, hours, organization, description, confirmation_status')
    .in('submission_id', submissionIds);
  if (eHrs) throw new Error(`hours_log.select failed: ${eHrs.message}`);
  const hoursBySub = new Map<number, any[]>();
  for (const h of hoursRaw ?? []) {
    const list = hoursBySub.get(h.submission_id as number);
    if (list) list.push(h);
    else hoursBySub.set(h.submission_id as number, [h]);
  }

  // Pull evidence_files for each submission (best-effort — table is optional).
  let filesBySub = new Map<number, any[]>();
  try {
    const { data: filesRaw, error: eF } = await sb
      .from('evidence_files')
      .select('id, submission_id, storage_path, filename, kind')
      .in('submission_id', submissionIds);
    if (eF) {
      console.warn(`[listApprovalQueue] evidence_files.select failed: ${eF.message}`);
    } else {
      for (const f of filesRaw ?? []) {
        const list = filesBySub.get(f.submission_id as number);
        if (list) list.push(f);
        else filesBySub.set(f.submission_id as number, [f]);
      }
    }
  } catch (e) {
    console.warn('[listApprovalQueue] evidence_files threw — continuing:', e);
    filesBySub = new Map();
  }

  return subs.map((s): ApprovalQueueItem => {
    const stu = s.students as {
      id: string;
      last_name: string;
      first_name: string;
      grad_year: number;
    };
    const hoursList = hoursBySub.get(s.id as number) ?? [];
    const hoursAgg = hoursList.length > 0 ? summarizeHours(hoursList) : null;
    const reflection = buildReflection({
      hours: hoursAgg,
      proposalData: s.proposal_data ?? null,
      notes: s.notes ?? null,
    });
    const files = (filesBySub.get(s.id as number) ?? []).map((f: any) => ({
      id: f.id as number,
      filename: f.filename as string,
      storagePath: f.storage_path as string,
      kind: f.kind as string,
    }));
    return {
      submissionId: s.id as number,
      studentId: stu.id,
      studentLastName: stu.last_name,
      studentFirstName: stu.first_name,
      gradYear: stu.grad_year,
      pathwayType: s.pathway_type as string,
      status: s.status as string,
      submittedAt: (s.submitted_at as string | null) ?? null,
      scoredAt: (s.scored_at as string | null) ?? null,
      defaultPoints: defaultPointsFor(s.pathway_type as string),
      capMaxPoints: capMaxFor(s.pathway_type as string),
      claim: buildClaim({
        pathwayType: s.pathway_type as string,
        hours: hoursAgg,
        proposalData: s.proposal_data ?? null,
      }),
      reflectionExcerpt: reflection.excerpt,
      reflectionTruncated: reflection.truncated,
      hoursTotal: hoursAgg ? hoursAgg.total : null,
      hoursConfirmed: hoursAgg
        ? hoursAgg.hasConfirmed && !hoursAgg.hasUnconfirmed
        : null,
      domainTags: (s.domain_tags as string[] | null) ?? [],
      evidenceFiles: files,
    };
  });
}

export interface ApproveInput {
  submissionId: number;
  approverId: string;
  points: number;
  notes?: string;
}

export interface RequestRevisionInput {
  submissionId: number;
  approverId: string;
  notes: string;
}

export interface DeclineInput {
  submissionId: number;
  approverId: string;
  reason: string;
}

/**
 * Move a submission to status='awarded' with the supplied points.
 *
 * Pre-condition: the submission must currently be in 'submitted' or 'scored'.
 * We don't enforce this at the DB level; we check it here so we surface a
 * descriptive error rather than silently overwriting a 'rejected' row.
 */
export async function approveSubmission(input: ApproveInput): Promise<void> {
  if (!Number.isFinite(input.points) || input.points < 0) {
    throw new Error('points must be a non-negative finite number');
  }
  const sb = supabaseAdmin();

  const { data: existing, error: eFetch } = await sb
    .from('pathway_submissions')
    .select('id, status, pathway_type')
    .eq('id', input.submissionId)
    .maybeSingle();
  if (eFetch) throw new Error(`pathway_submissions.select failed: ${eFetch.message}`);
  if (!existing) throw new Error(`submission ${input.submissionId} not found`);
  if (!['submitted', 'scored'].includes(existing.status as string)) {
    throw new Error(
      `submission ${input.submissionId} cannot be approved from status='${existing.status}'`,
    );
  }

  const nowIso = new Date().toISOString();
  const { error: eUp } = await sb
    .from('pathway_submissions')
    .update({
      status: 'awarded',
      points_awarded: input.points,
      awarded_at: nowIso,
      notes: input.notes ?? null,
      updated_at: nowIso,
    })
    .eq('id', input.submissionId);
  if (eUp) throw new Error(`pathway_submissions.update failed: ${eUp.message}`);

  const { error: eLog } = await sb.from('audit_log').insert({
    actor_id: input.approverId,
    actor_kind: 'counselor',
    action: 'counselor_approved_submission',
    target_type: 'pathway_submissions',
    target_id: String(input.submissionId),
    data: {
      pathway_type: existing.pathway_type,
      points_awarded: input.points,
      notes: input.notes ?? null,
    },
  });
  if (eLog) throw new Error(`audit_log.insert failed: ${eLog.message}`);
}

/**
 * Bounce a submission back to the student for revisions.
 *
 * Returns the submission to 'in_progress' so the student can edit / re-upload
 * before re-submitting. The counselor's notes are appended to the submission's
 * notes field so the student sees the rationale.
 */
export async function requestRevision(input: RequestRevisionInput): Promise<void> {
  if (!input.notes || input.notes.trim().length === 0) {
    throw new Error('revision notes are required');
  }
  const sb = supabaseAdmin();

  const { data: existing, error: eFetch } = await sb
    .from('pathway_submissions')
    .select('id, status, pathway_type, notes')
    .eq('id', input.submissionId)
    .maybeSingle();
  if (eFetch) throw new Error(`pathway_submissions.select failed: ${eFetch.message}`);
  if (!existing) throw new Error(`submission ${input.submissionId} not found`);

  const stamp = new Date().toISOString();
  const appended = [
    existing.notes ? String(existing.notes).trim() : null,
    `[${stamp}] Revision requested: ${input.notes.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const { error: eUp } = await sb
    .from('pathway_submissions')
    .update({
      status: 'in_progress',
      notes: appended,
      updated_at: stamp,
    })
    .eq('id', input.submissionId);
  if (eUp) throw new Error(`pathway_submissions.update failed: ${eUp.message}`);

  const { error: eLog } = await sb.from('audit_log').insert({
    actor_id: input.approverId,
    actor_kind: 'counselor',
    action: 'counselor_requested_revision',
    target_type: 'pathway_submissions',
    target_id: String(input.submissionId),
    data: {
      pathway_type: existing.pathway_type,
      notes: input.notes.trim(),
    },
  });
  if (eLog) throw new Error(`audit_log.insert failed: ${eLog.message}`);
}

/**
 * Decline a submission outright. Sets status='rejected'. Reason is stored
 * in the notes field (and the audit log). This is intentionally separate
 * from requestRevision — declined submissions cannot be edited and re-
 * submitted; the student has to start a fresh submission.
 */
export async function declineSubmission(input: DeclineInput): Promise<void> {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error('decline reason is required');
  }
  const sb = supabaseAdmin();

  const { data: existing, error: eFetch } = await sb
    .from('pathway_submissions')
    .select('id, status, pathway_type')
    .eq('id', input.submissionId)
    .maybeSingle();
  if (eFetch) throw new Error(`pathway_submissions.select failed: ${eFetch.message}`);
  if (!existing) throw new Error(`submission ${input.submissionId} not found`);

  const stamp = new Date().toISOString();
  const { error: eUp } = await sb
    .from('pathway_submissions')
    .update({
      status: 'rejected',
      notes: input.reason.trim(),
      updated_at: stamp,
    })
    .eq('id', input.submissionId);
  if (eUp) throw new Error(`pathway_submissions.update failed: ${eUp.message}`);

  const { error: eLog } = await sb.from('audit_log').insert({
    actor_id: input.approverId,
    actor_kind: 'counselor',
    action: 'counselor_declined_submission',
    target_type: 'pathway_submissions',
    target_id: String(input.submissionId),
    data: {
      pathway_type: existing.pathway_type,
      reason: input.reason.trim(),
    },
  });
  if (eLog) throw new Error(`audit_log.insert failed: ${eLog.message}`);
}
