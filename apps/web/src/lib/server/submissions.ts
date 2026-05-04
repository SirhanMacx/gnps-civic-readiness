import { z } from 'zod';
import { supabaseAdmin } from './supabase.js';
import { getStorage } from './storage.js';

export const ServiceSubmissionSchema = z.object({
  studentId: z.string().min(3, 'Student ID is required').max(40),
  studentLastName: z.string().min(1, 'Last name is required').max(80),
  studentFirstName: z.string().min(1, 'First name is required').max(80),
  studentEmail: z.string().email('Valid student email is required').max(200),
  gradYear: z.number().int().min(2024).max(2040),
  advisorEmail: z.string().email('Valid advisor / teacher email is required').max(200),
  activityName: z.string().min(2, 'Activity / organization is required').max(200),
  organization: z.string().min(2).max(200),
  serviceType: z.enum(['direct', 'indirect', 'advocacy']),
  hours: z.number().positive().max(200),
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date required'),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date required'),
  description: z.string().min(10, 'Description required (10+ chars)').max(500),
  supervisorName: z.string().min(2, 'Supervisor name is required').max(120),
  supervisorEmail: z.string().email('Valid supervisor email is required').max(200),
  supervisorOrg: z.string().min(2, 'Supervisor organization is required').max(200)
});
export type ServiceSubmission = z.infer<typeof ServiceSubmissionSchema>;

export interface SubmissionResult {
  submissionId: number;
  confirmationToken: string;
}

export async function createServiceSubmission(input: ServiceSubmission): Promise<SubmissionResult> {
  const data = ServiceSubmissionSchema.parse(input);
  const sb = supabaseAdmin();

  // Upsert student record (Phase 1 has no IC integration; trust the form)
  const { error: eStudent } = await sb.from('students').upsert(
    {
      id: data.studentId,
      last_name: data.studentLastName,
      first_name: data.studentFirstName,
      grad_year: data.gradYear,
      ...(data.studentEmail ? { email: data.studentEmail } : {})
    },
    { onConflict: 'id' }
  );
  if (eStudent) throw new Error(`students.upsert failed: ${eStudent.message} (code=${eStudent.code})`);

  const { data: sub, error: e1 } = await sb
    .from('pathway_submissions')
    .insert({
      student_id: data.studentId,
      pathway_type: 'service_learning',
      status: 'submitted',
      proposed_by_text: `${data.studentFirstName} ${data.studentLastName}`,
      submitted_at: new Date().toISOString()
    })
    .select()
    .single();
  if (e1 || !sub) throw new Error(`pathway_submissions.insert failed: ${e1?.message ?? 'unknown'} (code=${e1?.code ?? 'n/a'})`);

  const { data: log, error: e2 } = await sb
    .from('hours_log')
    .insert({
      submission_id: sub.id,
      activity_name: data.activityName,
      organization: data.organization,
      service_type: data.serviceType,
      hours: data.hours,
      date_start: data.dateStart,
      date_end: data.dateEnd,
      description: data.description,
      supervisor_name: data.supervisorName,
      supervisor_email: data.supervisorEmail,
      supervisor_org: data.supervisorOrg
    })
    .select()
    .single();
  if (e2 || !log) throw new Error(`hours_log.insert failed: ${e2?.message ?? 'unknown'} (code=${e2?.code ?? 'n/a'})`);

  await sb.from('audit_log').insert({
    actor_kind: 'student',
    action: 'student_submitted_service_hours',
    target_type: 'pathway_submissions',
    target_id: String(sub.id),
    data: { hours: data.hours, supervisor_email: data.supervisorEmail }
  });

  return {
    submissionId: sub.id as number,
    confirmationToken: log.confirmation_token as string
  };
}

// --- Identity helper -------------------------------------------------------
//
// All identity fields are required. studentEmail captures the student's
// preferred contact for the auto progress-report email. advisorEmail
// CCs the student's faculty advisor on those progress reports so the
// teacher / mentor stays in the loop without the student having to remember
// to forward.

const IdentityShape = {
  studentId: z.string().min(3, 'Student ID is required').max(40),
  studentLastName: z.string().min(1, 'Last name is required').max(80),
  studentFirstName: z.string().min(1, 'First name is required').max(80),
  studentEmail: z.string().email('Valid student email is required').max(200),
  gradYear: z.number().int().min(2024).max(2040),
  advisorEmail: z.string().email('Valid advisor / teacher email is required').max(200)
} as const;

async function upsertStudent(sb: SupabaseClientLike, data: {
  studentId: string;
  studentLastName: string;
  studentFirstName: string;
  studentEmail: string;
  gradYear: number;
}): Promise<void> {
  const { error } = await sb.from('students').upsert(
    {
      id: data.studentId,
      last_name: data.studentLastName,
      first_name: data.studentFirstName,
      grad_year: data.gradYear,
      email: data.studentEmail
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(`students.upsert failed: ${error.message} (code=${error.code})`);
}

// Minimal type alias so we don't have to import full SupabaseClient generics.
type SupabaseClientLike = ReturnType<typeof supabaseAdmin>;

// --- Pathway 2e — Extra-curricular / Work-Based Learning -------------------

export const WblSubmissionSchema = z.object({
  ...IdentityShape,
  activityName: z.string().min(2, 'Activity name is required').max(200),
  organization: z.string().min(2, 'Organization is required').max(200),
  hours: z.number().positive().max(500),
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(1500),
  supervisorName: z.string().min(2).max(120),
  supervisorEmail: z.string().email().max(200),
  supervisorOrg: z.string().max(200).optional().default('')
});
export type WblSubmission = z.infer<typeof WblSubmissionSchema>;

export async function createWblSubmission(input: WblSubmission): Promise<SubmissionResult> {
  const data = WblSubmissionSchema.parse(input);
  const sb = supabaseAdmin();

  await upsertStudent(sb, data);

  const { data: sub, error: e1 } = await sb
    .from('pathway_submissions')
    .insert({
      student_id: data.studentId,
      pathway_type: 'wbl_extracurr',
      status: 'submitted',
      proposed_by_text: `${data.studentFirstName} ${data.studentLastName}`,
      submitted_at: new Date().toISOString()
    })
    .select()
    .single();
  if (e1 || !sub) throw new Error(`pathway_submissions.insert failed: ${e1?.message ?? 'unknown'} (code=${e1?.code ?? 'n/a'})`);

  const { data: log, error: e2 } = await sb
    .from('hours_log')
    .insert({
      submission_id: sub.id,
      activity_name: data.activityName,
      organization: data.organization,
      service_type: null, // WBL has no NYSED service-type taxonomy
      hours: data.hours,
      date_start: data.dateStart,
      date_end: data.dateEnd,
      description: data.description,
      supervisor_name: data.supervisorName,
      supervisor_email: data.supervisorEmail,
      supervisor_org: data.supervisorOrg
    })
    .select()
    .single();
  if (e2 || !log) throw new Error(`hours_log.insert failed: ${e2?.message ?? 'unknown'} (code=${e2?.code ?? 'n/a'})`);

  await sb.from('audit_log').insert({
    actor_kind: 'student',
    action: 'student_submitted_wbl_hours',
    target_type: 'pathway_submissions',
    target_id: String(sub.id),
    data: { hours: data.hours, supervisor_email: data.supervisorEmail }
  });

  return {
    submissionId: sub.id as number,
    confirmationToken: log.confirmation_token as string
  };
}

// --- Project proposal pathways (1e, 2a, 2f, MS capstone) -------------------

export const PROJECT_PATHWAY_TYPES = [
  'research_project',
  'hs_civic_project',
  'hs_capstone',
  'ms_capstone'
] as const;

export const ProjectProposalSchema = z.object({
  ...IdentityShape,
  pathwayType: z.enum(PROJECT_PATHWAY_TYPES),
  issueIdentified: z.string().min(30, 'Describe the issue or research question in at least 30 characters').max(2000),
  scope: z.enum(['local', 'state', 'national', 'global']),
  civicExperiencePlan: z.string().min(30, 'Civic-experience plan must be at least 30 characters').max(3000),
  advisorName: z.string().min(2, 'Advisor name is required').max(120),
  domainTags: z.array(z.enum(['knowledge', 'skills', 'mindsets', 'experiences'])).min(1, 'Select at least one civic-readiness domain')
});
export type ProjectProposal = z.infer<typeof ProjectProposalSchema>;

export interface ProposalResult {
  submissionId: number;
}

export async function createProjectProposal(input: ProjectProposal): Promise<ProposalResult> {
  const data = ProjectProposalSchema.parse(input);
  const sb = supabaseAdmin();

  await upsertStudent(sb, data);

  const { data: sub, error: e1 } = await sb
    .from('pathway_submissions')
    .insert({
      student_id: data.studentId,
      pathway_type: data.pathwayType,
      status: 'proposed',
      proposed_at: new Date().toISOString(),
      proposed_by_text: `${data.studentFirstName} ${data.studentLastName}`,
      domain_tags: data.domainTags,
      proposal_data: {
        issue_identified: data.issueIdentified,
        scope: data.scope,
        civic_experience_plan: data.civicExperiencePlan,
        advisor_name: data.advisorName
      }
    })
    .select()
    .single();
  if (e1 || !sub) throw new Error(`pathway_submissions.insert failed: ${e1?.message ?? 'unknown'} (code=${e1?.code ?? 'n/a'})`);

  await sb.from('audit_log').insert({
    actor_kind: 'student',
    action: 'student_submitted_project_proposal',
    target_type: 'pathway_submissions',
    target_id: String(sub.id),
    data: {
      pathway_type: data.pathwayType,
      scope: data.scope,
      domain_tags: data.domainTags,
      advisor_name: data.advisorName
    }
  });

  return { submissionId: sub.id as number };
}

// --- Pathway 2c — Civic-Engagement Elective Essay --------------------------

export const CivicElectiveEssaySchema = z.object({
  ...IdentityShape,
  courseCode: z.string().min(2, 'Course code is required').max(40),
  courseYear: z.string().regex(/^\d{4}-\d{4}$/, 'Course year must be in the form 2025-2026'),
  fileName: z.string().min(1, 'File name missing').max(200),
  fileMimeType: z.string().min(1).max(120),
  fileBytes: z.instanceof(Uint8Array).refine((b) => b.byteLength > 0, 'Essay file is empty')
});
export type CivicElectiveEssay = z.infer<typeof CivicElectiveEssaySchema>;

export interface EssayUploadResult {
  submissionId: number;
  storagePath: string | null;
  storageWarning?: string;
}

export async function createCivicElectiveEssay(input: CivicElectiveEssay): Promise<EssayUploadResult> {
  const data = CivicElectiveEssaySchema.parse(input);
  const sb = supabaseAdmin();

  await upsertStudent(sb, data);

  const { data: sub, error: e1 } = await sb
    .from('pathway_submissions')
    .insert({
      student_id: data.studentId,
      pathway_type: 'civic_elective_essay',
      status: 'submitted',
      proposed_by_text: `${data.studentFirstName} ${data.studentLastName}`,
      submitted_at: new Date().toISOString(),
      proposal_data: {
        course_code: data.courseCode,
        course_year: data.courseYear,
        file_name: data.fileName,
        file_mime_type: data.fileMimeType,
        file_size_bytes: data.fileBytes.byteLength
      }
    })
    .select()
    .single();
  if (e1 || !sub) throw new Error(`pathway_submissions.insert failed: ${e1?.message ?? 'unknown'} (code=${e1?.code ?? 'n/a'})`);

  // Try to write the file to the configured storage backend (filesystem in
  // single-server deployments, S3-compatible if STORAGE_BACKEND=s3). If the
  // upload fails we still keep the submission row and surface a soft warning
  // — counselor review can re-run the upload.
  let storagePath: string | null = null;
  let storageWarning: string | undefined;
  const safeName = data.fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  const path = `civic_elective/${data.studentId}/${sub.id}-${safeName}`;
  try {
    const stored = await getStorage().upload(path, data.fileBytes, data.fileMimeType);
    storagePath = stored.storagePath;
  } catch (e) {
    storageWarning = `evidence storage upload threw: ${e instanceof Error ? e.message : String(e)}`;
    console.warn(storageWarning);
  }

  // Try to record the upload in evidence_files. Table may not exist yet in
  // Phase 1 dev environments — degrade gracefully.
  if (storagePath) {
    try {
      const { error: efErr } = await sb.from('evidence_files').insert({
        submission_id: sub.id,
        storage_path: storagePath,
        filename: data.fileName,
        mime_type: data.fileMimeType,
        size_bytes: data.fileBytes.byteLength,
        kind: 'reflection_essay'
      });
      if (efErr) {
        console.warn(`evidence_files.insert failed (will continue): ${efErr.message}`);
      }
    } catch (e) {
      console.warn(`evidence_files.insert threw (will continue):`, e);
    }
  }

  await sb.from('audit_log').insert({
    actor_kind: 'student',
    action: 'student_uploaded_civic_elective_essay',
    target_type: 'pathway_submissions',
    target_id: String(sub.id),
    data: {
      course_code: data.courseCode,
      course_year: data.courseYear,
      file_name: data.fileName,
      storage_path: storagePath,
      storage_warning: storageWarning ?? null
    }
  });

  return {
    submissionId: sub.id as number,
    storagePath,
    storageWarning
  };
}
