import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { createWblSubmission, WblSubmissionSchema } from '$server/submissions.js';
import { sendStudentProgressEmail } from '$server/student-progress-email.js';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const parsed = WblSubmissionSchema.safeParse({
      studentId: form.get('studentId'),
      studentLastName: form.get('studentLastName'),
      studentFirstName: form.get('studentFirstName'),
      studentEmail: form.get('studentEmail') ?? '',
      advisorEmail: form.get('advisorEmail') ?? '',
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
      let progressSent = false;
      if (parsed.data.studentEmail) {
        const r = await sendStudentProgressEmail({
          studentId: parsed.data.studentId,
          studentEmail: parsed.data.studentEmail,
          studentFirstName: parsed.data.studentFirstName,
          studentLastName: parsed.data.studentLastName,
          advisorEmail: parsed.data.advisorEmail,
          justSubmittedPathway: 'wbl_extracurr'
        });
        progressSent = r.ok;
      }
      return {
        success: true,
        supervisorEmail: parsed.data.supervisorEmail,
        hours: parsed.data.hours,
        studentEmail: parsed.data.studentEmail || undefined,
        studentProgressSent: progressSent
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('createWblSubmission failed:', msg, e);
      return fail(500, { error: `Save failed: ${msg}` });
    }
  }
};
