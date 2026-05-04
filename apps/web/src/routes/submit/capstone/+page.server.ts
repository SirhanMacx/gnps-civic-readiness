import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { createProjectProposal, ProjectProposalSchema } from '$server/submissions.js';
import { sendStudentProgressEmail } from '$server/student-progress-email.js';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const domains = form.getAll('domains').map(String).filter(Boolean);
    const parsed = ProjectProposalSchema.safeParse({
      studentId: form.get('studentId'),
      studentLastName: form.get('studentLastName'),
      studentFirstName: form.get('studentFirstName'),
      studentEmail: form.get('studentEmail') ?? '',
      gradYear: Number(form.get('gradYear')),
      pathwayType: 'hs_capstone',
      issueIdentified: form.get('issueIdentified'),
      scope: form.get('scope'),
      civicExperiencePlan: form.get('civicExperiencePlan'),
      advisorName: form.get('advisorName'),
      domainTags: domains
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.errors[0]?.message ?? 'Invalid input' });
    }
    try {
      const result = await createProjectProposal(parsed.data);
      let progressSent = false;
      if (parsed.data.studentEmail) {
        const r = await sendStudentProgressEmail({
          studentId: parsed.data.studentId,
          studentEmail: parsed.data.studentEmail,
          studentFirstName: parsed.data.studentFirstName,
          studentLastName: parsed.data.studentLastName,
          justSubmittedPathway: 'hs_capstone'
        });
        progressSent = r.ok;
      }
      return {
        success: true,
        submissionId: result.submissionId,
        studentEmail: parsed.data.studentEmail || undefined,
        studentProgressSent: progressSent
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('createProjectProposal (hs_capstone) failed:', msg, e);
      return fail(500, { error: `Save failed: ${msg}` });
    }
  }
};
