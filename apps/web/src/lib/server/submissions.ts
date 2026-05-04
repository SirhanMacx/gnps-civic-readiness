import { z } from 'zod';
import { supabaseAdmin } from './supabase.js';

export const ServiceSubmissionSchema = z.object({
  studentId: z.string().min(3).max(40),
  studentLastName: z.string().min(1).max(80),
  studentFirstName: z.string().min(1).max(80),
  gradYear: z.number().int().min(2024).max(2040),
  activityName: z.string().min(2).max(200),
  organization: z.string().min(2).max(200),
  serviceType: z.enum(['direct', 'indirect', 'advocacy']),
  hours: z.number().positive().max(200),
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional().default(''),
  supervisorName: z.string().min(2).max(120),
  supervisorEmail: z.string().email().max(200),
  supervisorOrg: z.string().max(200).optional().default('')
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
  await sb.from('students').upsert(
    {
      id: data.studentId,
      last_name: data.studentLastName,
      first_name: data.studentFirstName,
      grad_year: data.gradYear
    },
    { onConflict: 'id' }
  );

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
  if (e1 || !sub) throw e1 ?? new Error('pathway_submissions insert failed');

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
  if (e2 || !log) throw e2 ?? new Error('hours_log insert failed');

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
