/**
 * Server-side helpers for the SCRC (Seal of Civic Readiness Committee) portal.
 *
 * Two queues:
 *   1. Proposal queue — submissions with status='proposed' on project pathways
 *      (research_project, hs_civic_project, hs_capstone, ms_capstone).
 *      The committee approves topics, requests revisions, or rejects.
 *   2. Scoring queue — submissions with status='submitted' (student has uploaded
 *      evidence after topic approval). The committee scores against the NYSED
 *      pathway-specific rubric and the row advances to 'scored'.
 *
 * All writes go through `supabaseAdmin()` (service role bypasses RLS).
 * Every state change writes a row to `audit_log` with an `scrc_*` action so the
 * NYSED audit pack PDF can show topic-approval and score provenance.
 *
 * Pathway rubric design (NYSED criteria mapping):
 *   - research_project   → Appendix F (4 criteria, 1-4 each, 16pt total → 1pt awarded)
 *   - hs_civic_project   → Appendix G (5 criteria, 1-4 each, 20pt total → 1.5pt awarded)
 *   - hs_capstone        → Appendix P / 4 essential elements (4 criteria, 1-4 each,
 *                          16pt total → 4pt awarded)
 *   - ms_capstone        → 4 essential elements (4 criteria, 1-4 each, 16pt total
 *                          → 1pt awarded)
 *
 * Points are computed proportionally:
 *   pointsAwarded = pathwayMaxPoints * (sumScores / maxPossibleScores)
 *   then rounded to the nearest 0.5.
 *
 * See spec §5.4 (SCRC review flow) and §6 (NYSED compliance mapping).
 */

import { z } from 'zod';
import { supabaseAdmin } from './supabase.js';

/**
 * Pathway types the SCRC reviews. ms_capstone is here for completeness even
 * though district practice is to score it via middle-school staff — the SCRC
 * portal still surfaces them in case a district wants central oversight.
 */
export const SCRC_PATHWAY_TYPES = [
  'research_project',
  'hs_civic_project',
  'hs_capstone',
  'ms_capstone'
] as const;
export type ScrcPathway = (typeof SCRC_PATHWAY_TYPES)[number];

/**
 * Per-pathway rubric definition. Each criterion is scored 1-4. The
 * `maxPoints` is the NYSED award (e.g. 4 for capstone, 1.5 for civic project).
 */
export interface RubricCriterion {
  key: string;
  label: string;
  description: string;
}

export interface RubricDefinition {
  pathway: ScrcPathway;
  appendix: string;
  maxPoints: number;
  scaleMax: number; // always 4 in NYSED; kept explicit for clarity
  criteria: RubricCriterion[];
}

export const RUBRICS: Record<ScrcPathway, RubricDefinition> = {
  research_project: {
    pathway: 'research_project',
    appendix: 'NYSED Appendix F',
    maxPoints: 1,
    scaleMax: 4,
    criteria: [
      {
        key: 'research_question',
        label: 'Research question',
        description:
          'Question is focused, civically relevant, and connects to a local/state/national/global issue.'
      },
      {
        key: 'sources',
        label: 'Sources & evidence',
        description:
          'Uses multiple credible primary and secondary sources, properly cited.'
      },
      {
        key: 'analysis',
        label: 'Analysis',
        description:
          'Synthesizes evidence to support a clear claim; addresses counter-evidence.'
      },
      {
        key: 'presentation',
        label: 'Presentation',
        description:
          'Clear written/oral presentation; mechanics support communication of ideas.'
      }
    ]
  },
  hs_civic_project: {
    pathway: 'hs_civic_project',
    appendix: 'NYSED Appendix G',
    maxPoints: 1.5,
    scaleMax: 4,
    criteria: [
      {
        key: 'issue_identification',
        label: 'Issue identification',
        description: 'Identifies a clear civic issue (local/state/national/global).'
      },
      {
        key: 'civic_knowledge',
        label: 'Civic knowledge',
        description: 'Applies relevant civic knowledge and processes.'
      },
      {
        key: 'civic_action',
        label: 'Civic action / experience',
        description: 'Engages in concrete civic action to influence change.'
      },
      {
        key: 'evidence_quality',
        label: 'Evidence & artifact quality',
        description: 'Artifact and supporting evidence are well-organized and credible.'
      },
      {
        key: 'reflection',
        label: 'Reflection',
        description:
          'Connects work to civic-readiness domains (knowledge, skills, mindsets, experiences).'
      }
    ]
  },
  hs_capstone: {
    pathway: 'hs_capstone',
    appendix: 'NYSED Appendix P (4 essential elements)',
    maxPoints: 4,
    scaleMax: 4,
    criteria: [
      {
        key: 'identify_issue',
        label: 'Identify an issue',
        description:
          'Clearly identifies an issue (local, state, national, or global) of civic importance.'
      },
      {
        key: 'apply_civic_kskm',
        label: 'Apply civic knowledge, skills, actions, and mindsets',
        description:
          'Demonstrates application of civic knowledge, skills, actions, and mindsets to the issue.'
      },
      {
        key: 'civic_experience',
        label: 'Engage in a civic experience',
        description:
          'Engages in a civic experience based on the issue to influence positive change in the community.'
      },
      {
        key: 'present_to_committee',
        label: 'Present to committee',
        description:
          'Presents the overall project to the school Civic Readiness Committee.'
      }
    ]
  },
  ms_capstone: {
    pathway: 'ms_capstone',
    appendix: 'MS capstone — 4 essential elements',
    maxPoints: 1,
    scaleMax: 4,
    criteria: [
      {
        key: 'identify_issue',
        label: 'Identify an issue',
        description: 'Identifies a community, state, national, or global issue.'
      },
      {
        key: 'apply_civic_kskm',
        label: 'Apply civic knowledge, skills, actions, and mindsets',
        description:
          'Applies grade-appropriate civic knowledge, skills, actions, and mindsets.'
      },
      {
        key: 'civic_experience',
        label: 'Engage in a civic experience',
        description:
          'Participates in a civic experience to influence positive change.'
      },
      {
        key: 'present',
        label: 'Present project',
        description: 'Presents the project to peers, faculty, or the committee.'
      }
    ]
  }
};

export function getRubric(pathway: ScrcPathway): RubricDefinition {
  return RUBRICS[pathway];
}

// --- Listing helpers --------------------------------------------------------

export type SubmissionStatus =
  | 'draft'
  | 'proposed'
  | 'topic_approved'
  | 'in_progress'
  | 'submitted'
  | 'scored'
  | 'awarded'
  | 'rejected'
  | 'revoked';

export interface QueueRow {
  submissionId: number;
  studentId: string;
  studentFullName: string;
  gradYear: number;
  pathwayType: ScrcPathway;
  status: SubmissionStatus;
  proposedAt: string | null;
  submittedAt: string | null;
  scope: string | null;
  issueIdentified: string | null;
  advisorName: string | null;
  domainTags: string[];
}

interface RawSubmissionRow {
  id: number;
  student_id: string;
  pathway_type: string;
  status: string;
  proposed_at: string | null;
  submitted_at: string | null;
  domain_tags: string[] | null;
  proposal_data: Record<string, unknown> | null;
  /** Optional embedded students payload (legacy supabase shape; kept for tests). */
  students?: { first_name: string; last_name: string; grad_year: number } | null;
}

interface StudentLookupRow {
  id: string;
  first_name: string;
  last_name: string;
  grad_year: number;
}

function mapQueueRow(
  r: RawSubmissionRow,
  studentByIdOrInline?: Map<string, StudentLookupRow>
): QueueRow {
  const proposal = (r.proposal_data ?? {}) as {
    issue_identified?: string;
    scope?: string;
    advisor_name?: string;
  };
  const inline = r.students;
  const looked = studentByIdOrInline?.get(r.student_id);
  const student = inline ?? looked ?? null;
  const fullName = student
    ? `${student.first_name} ${student.last_name}`.trim()
    : '(unknown student)';
  return {
    submissionId: r.id,
    studentId: r.student_id,
    studentFullName: fullName,
    gradYear: student?.grad_year ?? 0,
    pathwayType: r.pathway_type as ScrcPathway,
    status: r.status as SubmissionStatus,
    proposedAt: r.proposed_at,
    submittedAt: r.submitted_at,
    scope: proposal.scope ?? null,
    issueIdentified: proposal.issue_identified ?? null,
    advisorName: proposal.advisor_name ?? null,
    domainTags: r.domain_tags ?? []
  };
}

async function lookupStudents(
  sb: ReturnType<typeof supabaseAdmin>,
  studentIds: readonly string[]
): Promise<Map<string, StudentLookupRow>> {
  const map = new Map<string, StudentLookupRow>();
  if (studentIds.length === 0) return map;
  const { data, error } = await sb
    .from('students')
    .select('id, first_name, last_name, grad_year')
    .in('id', studentIds);
  if (error || !data) return map;
  for (const r of data as unknown as StudentLookupRow[]) {
    map.set(r.id, r);
  }
  return map;
}

/**
 * List submissions awaiting topic approval. Status='proposed' on project pathways.
 *
 * Joining `students` once was a Supabase nicety. Post-migration we fetch the
 * submission rows first, then issue a single follow-up `IN (...)` over students
 * — avoiding the embedded-resource syntax the direct-Postgres facade doesn't
 * model.
 */
export async function listProposalQueue(): Promise<QueueRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('pathway_submissions')
    .select(
      'id, student_id, pathway_type, status, proposed_at, submitted_at, domain_tags, proposal_data'
    )
    .eq('status', 'proposed')
    .in('pathway_type', SCRC_PATHWAY_TYPES as unknown as string[])
    .order('proposed_at', { ascending: true });
  if (error) throw new Error(`listProposalQueue failed: ${error.message}`);
  const rows = (data ?? []) as unknown as RawSubmissionRow[];
  const studentMap = await lookupStudents(sb, rows.map((r) => r.student_id));
  return rows.map((r) => mapQueueRow(r, studentMap));
}

/**
 * List submissions awaiting final scoring. Status='submitted' on project pathways.
 */
export async function listScoringQueue(): Promise<QueueRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('pathway_submissions')
    .select(
      'id, student_id, pathway_type, status, proposed_at, submitted_at, domain_tags, proposal_data'
    )
    .eq('status', 'submitted')
    .in('pathway_type', SCRC_PATHWAY_TYPES as unknown as string[])
    .order('submitted_at', { ascending: true });
  if (error) throw new Error(`listScoringQueue failed: ${error.message}`);
  const rows = (data ?? []) as unknown as RawSubmissionRow[];
  const studentMap = await lookupStudents(sb, rows.map((r) => r.student_id));
  return rows.map((r) => mapQueueRow(r, studentMap));
}

/**
 * Count of awarded submissions for any project pathway — surfaced as a
 * "this year" stat on the dashboard.
 */
export async function countAwardedProjects(): Promise<number> {
  const sb = supabaseAdmin();
  const { count, error } = await sb
    .from('pathway_submissions')
    .select('id', { count: 'exact', head: true })
    .in('pathway_type', SCRC_PATHWAY_TYPES as unknown as string[])
    .in('status', ['scored', 'awarded']);
  if (error) throw new Error(`countAwardedProjects failed: ${error.message}`);
  return count ?? 0;
}

// --- Detail loader ----------------------------------------------------------

export interface SubmissionDetail extends QueueRow {
  rubricScores: Record<string, number>;
  pointsAwarded: number | null;
  notes: string | null;
  proposalData: Record<string, unknown>;
  scoredAt: string | null;
  topicApprovedAt: string | null;
}

export async function getSubmissionDetail(submissionId: number): Promise<SubmissionDetail | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('pathway_submissions')
    .select(
      'id, student_id, pathway_type, status, proposed_at, submitted_at, scored_at, topic_approved_at, points_awarded, domain_tags, proposal_data, rubric_scores, notes'
    )
    .eq('id', submissionId)
    .maybeSingle();
  if (error) throw new Error(`getSubmissionDetail failed: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as RawSubmissionRow & {
    rubric_scores: Record<string, number> | null;
    points_awarded: number | null;
    notes: string | null;
    scored_at: string | null;
    topic_approved_at: string | null;
  };
  const studentMap = await lookupStudents(sb, [row.student_id]);
  const base = mapQueueRow(row, studentMap);
  return {
    ...base,
    rubricScores: row.rubric_scores ?? {},
    pointsAwarded: row.points_awarded ?? null,
    notes: row.notes ?? null,
    proposalData: row.proposal_data ?? {},
    scoredAt: row.scored_at ?? null,
    topicApprovedAt: row.topic_approved_at ?? null
  };
}

// --- Mutations --------------------------------------------------------------

export const ApproveTopicSchema = z.object({
  submissionId: z.number().int().positive(),
  reviewerId: z.string().uuid(),
  notes: z.string().max(2000).optional()
});
export type ApproveTopicInput = z.infer<typeof ApproveTopicSchema>;

export async function approveTopic(input: ApproveTopicInput): Promise<void> {
  const data = ApproveTopicSchema.parse(input);
  const sb = supabaseAdmin();

  const update: Record<string, unknown> = {
    status: 'topic_approved',
    topic_approved_at: new Date().toISOString(),
    topic_approved_by: data.reviewerId,
    updated_at: new Date().toISOString()
  };
  if (data.notes) update.notes = data.notes;

  const { error: upErr } = await sb
    .from('pathway_submissions')
    .update(update)
    .eq('id', data.submissionId)
    .eq('status', 'proposed');
  if (upErr) throw new Error(`approveTopic update failed: ${upErr.message}`);

  const { error: auditErr } = await sb.from('audit_log').insert({
    actor_id: data.reviewerId,
    actor_kind: 'scrc_member',
    action: 'scrc_approved_topic',
    target_type: 'pathway_submissions',
    target_id: String(data.submissionId),
    data: { notes: data.notes ?? null }
  });
  if (auditErr) throw new Error(`approveTopic audit insert failed: ${auditErr.message}`);
}

export const RejectTopicSchema = z.object({
  submissionId: z.number().int().positive(),
  reviewerId: z.string().uuid(),
  reason: z.string().min(5, 'Provide a reason').max(2000)
});
export type RejectTopicInput = z.infer<typeof RejectTopicSchema>;

export async function rejectTopic(input: RejectTopicInput): Promise<void> {
  const data = RejectTopicSchema.parse(input);
  const sb = supabaseAdmin();

  const { error: upErr } = await sb
    .from('pathway_submissions')
    .update({
      status: 'rejected',
      notes: data.reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', data.submissionId)
    .eq('status', 'proposed');
  if (upErr) throw new Error(`rejectTopic update failed: ${upErr.message}`);

  const { error: auditErr } = await sb.from('audit_log').insert({
    actor_id: data.reviewerId,
    actor_kind: 'scrc_member',
    action: 'scrc_rejected_topic',
    target_type: 'pathway_submissions',
    target_id: String(data.submissionId),
    data: { reason: data.reason }
  });
  if (auditErr) throw new Error(`rejectTopic audit insert failed: ${auditErr.message}`);
}

export const RequestRevisionsSchema = z.object({
  submissionId: z.number().int().positive(),
  reviewerId: z.string().uuid(),
  notes: z.string().min(5, 'Tell the student what to revise').max(2000)
});
export type RequestRevisionsInput = z.infer<typeof RequestRevisionsSchema>;

export async function requestProposalRevisions(input: RequestRevisionsInput): Promise<void> {
  const data = RequestRevisionsSchema.parse(input);
  const sb = supabaseAdmin();

  // Status stays 'proposed' — only notes update.
  const { error: upErr } = await sb
    .from('pathway_submissions')
    .update({
      notes: data.notes,
      updated_at: new Date().toISOString()
    })
    .eq('id', data.submissionId)
    .eq('status', 'proposed');
  if (upErr) throw new Error(`requestProposalRevisions update failed: ${upErr.message}`);

  const { error: auditErr } = await sb.from('audit_log').insert({
    actor_id: data.reviewerId,
    actor_kind: 'scrc_member',
    action: 'scrc_requested_topic_revisions',
    target_type: 'pathway_submissions',
    target_id: String(data.submissionId),
    data: { notes: data.notes }
  });
  if (auditErr) throw new Error(`requestProposalRevisions audit insert failed: ${auditErr.message}`);
}

// --- Scoring ----------------------------------------------------------------

export const ScoreSchema = z.object({
  submissionId: z.number().int().positive(),
  reviewerId: z.string().uuid(),
  pathway: z.enum(SCRC_PATHWAY_TYPES),
  rubricScores: z.record(z.string(), z.number().int().min(1).max(4)),
  notes: z.string().max(2000).optional()
});
export type ScoreInput = z.infer<typeof ScoreSchema>;

/**
 * Round a number to the nearest 0.5.
 */
function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/**
 * Compute proportional points awarded for a pathway given a per-criterion
 * rubric map.
 *
 *   pointsAwarded = pathwayMaxPoints * (sumScores / maxPossibleScores)
 *
 * Then rounded to the nearest 0.5. Any criterion missing from the rubric
 * scores is treated as 0 (no credit).
 */
export function computePointsAwarded(
  pathway: ScrcPathway,
  scores: Record<string, number>
): number {
  const rubric = RUBRICS[pathway];
  const sum = rubric.criteria.reduce((acc, c) => acc + (scores[c.key] ?? 0), 0);
  const maxSum = rubric.criteria.length * rubric.scaleMax;
  if (maxSum === 0) return 0;
  const ratio = sum / maxSum;
  return roundHalf(rubric.maxPoints * ratio);
}

/**
 * Score a completed project. Status 'submitted' → 'scored'. Stores the
 * rubric_scores JSONB and computed points_awarded. Writes an audit row.
 */
export async function scoreCompletedProject(input: ScoreInput): Promise<{ pointsAwarded: number }> {
  const data = ScoreSchema.parse(input);
  const sb = supabaseAdmin();

  // Validate that every criterion in the rubric received a score.
  const rubric = RUBRICS[data.pathway];
  const missing = rubric.criteria
    .filter((c) => typeof data.rubricScores[c.key] !== 'number')
    .map((c) => c.key);
  if (missing.length > 0) {
    throw new Error(`scoreCompletedProject missing criteria: ${missing.join(', ')}`);
  }

  const pointsAwarded = computePointsAwarded(data.pathway, data.rubricScores);

  const update: Record<string, unknown> = {
    status: 'scored',
    rubric_scores: data.rubricScores,
    points_awarded: pointsAwarded,
    scored_at: new Date().toISOString(),
    scored_by: data.reviewerId,
    updated_at: new Date().toISOString()
  };
  if (data.notes) update.notes = data.notes;

  const { error: upErr } = await sb
    .from('pathway_submissions')
    .update(update)
    .eq('id', data.submissionId)
    .eq('status', 'submitted');
  if (upErr) throw new Error(`scoreCompletedProject update failed: ${upErr.message}`);

  const { error: auditErr } = await sb.from('audit_log').insert({
    actor_id: data.reviewerId,
    actor_kind: 'scrc_member',
    action: 'scrc_scored_project',
    target_type: 'pathway_submissions',
    target_id: String(data.submissionId),
    data: {
      pathway: data.pathway,
      rubric_scores: data.rubricScores,
      points_awarded: pointsAwarded,
      notes: data.notes ?? null
    }
  });
  if (auditErr) throw new Error(`scoreCompletedProject audit insert failed: ${auditErr.message}`);

  return { pointsAwarded };
}

// --- Evidence files ---------------------------------------------------------

export interface EvidenceFileLink {
  filename: string;
  signedUrl: string | null;
  storagePath: string;
  warning?: string;
}

/**
 * Best-effort fetch of evidence file rows for a submission and signed URLs
 * for each file. The `evidence_files` table may not exist yet in some Phase 1
 * dev environments, in which case this returns []. Errors are swallowed and
 * logged — the review page should still render.
 *
 * Storage URLs come from `getStorage()` (filesystem-default; S3 if
 * `STORAGE_BACKEND=s3`). Signed URLs are HMAC-tokens consumed by
 * `/api/evidence/[token]`, with an additional staff-role gate enforced server-side.
 */
export async function getEvidenceLinks(submissionId: number): Promise<EvidenceFileLink[]> {
  const sb = supabaseAdmin();
  const { getStorage } = await import('./storage.js');

  let rows: { storage_path: string; filename: string }[] = [];
  try {
    const { data, error } = await sb
      .from('evidence_files')
      .select('storage_path, filename')
      .eq('submission_id', submissionId);
    if (error) {
      // 42P01 = relation does not exist (Postgres). Phase 1 dev: no table yet.
      console.warn(`evidence_files lookup failed (will continue): ${error.message}`);
      return [];
    }
    rows = (data ?? []) as { storage_path: string; filename: string }[];
  } catch (e) {
    console.warn('evidence_files threw (will continue):', e);
    return [];
  }

  const out: EvidenceFileLink[] = [];
  for (const r of rows) {
    try {
      const url = await getStorage().signedUrl(r.storage_path, 3600);
      out.push({
        filename: r.filename,
        signedUrl: url,
        storagePath: r.storage_path
      });
    } catch (e) {
      out.push({
        filename: r.filename,
        signedUrl: null,
        storagePath: r.storage_path,
        warning: e instanceof Error ? e.message : 'signed URL threw'
      });
    }
  }
  return out;
}
