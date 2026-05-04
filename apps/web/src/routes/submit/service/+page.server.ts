import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { createServiceSubmission, ServiceSubmissionSchema } from '$server/submissions.js';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const parsed = ServiceSubmissionSchema.safeParse({
      studentId: form.get('studentId'),
      studentLastName: form.get('studentLastName'),
      studentFirstName: form.get('studentFirstName'),
      gradYear: Number(form.get('gradYear')),
      activityName: form.get('activityName'),
      organization: form.get('activityName'), // same as activity for now
      serviceType: form.get('serviceType'),
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
      await createServiceSubmission(parsed.data);
      return { success: true, supervisorEmail: parsed.data.supervisorEmail };
    } catch (e) {
      console.error(e);
      return fail(500, { error: 'Could not save submission. Please try again or email civicseal@greatneck.k12.ny.us.' });
    }
  }
};
