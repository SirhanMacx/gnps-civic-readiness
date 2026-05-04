import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { createProjectProposal, ProjectProposalSchema } from '$server/submissions.js';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const domains = form.getAll('domains').map(String).filter(Boolean);
    const parsed = ProjectProposalSchema.safeParse({
      studentId: form.get('studentId'),
      studentLastName: form.get('studentLastName'),
      studentFirstName: form.get('studentFirstName'),
      gradYear: Number(form.get('gradYear')),
      pathwayType: 'hs_civic_project',
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
      return { success: true, submissionId: result.submissionId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('createProjectProposal (hs_civic_project) failed:', msg, e);
      return fail(500, { error: `Save failed: ${msg}` });
    }
  }
};
