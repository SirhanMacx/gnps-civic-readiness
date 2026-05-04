import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { createWblSubmission, WblSubmissionSchema } from '$server/submissions.js';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const parsed = WblSubmissionSchema.safeParse({
      studentId: form.get('studentId'),
      studentLastName: form.get('studentLastName'),
      studentFirstName: form.get('studentFirstName'),
      gradYear: Number(form.get('gradYear')),
      activityName: form.get('activityName'),
      organization: form.get('organization') ?? form.get('activityName'),
      hours: Number(form.get('hours')),
      dateStart: form.get('dateStart'),
      dateEnd: form.get('dateEnd'),
      description: form.get('description') ?? '',
      supervisorName: form.get('supervisorName'),
      supervisorEmail: form.get('supervisorEmail'),
      supervisorOrg: form.get('supervisorOrg') ?? ''
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.errors[0]?.message ?? 'Invalid input' });
    }
    try {
      await createWblSubmission(parsed.data);
      return {
        success: true,
        supervisorEmail: parsed.data.supervisorEmail,
        hours: parsed.data.hours
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('createWblSubmission failed:', msg, e);
      return fail(500, { error: `Save failed: ${msg}` });
    }
  }
};
