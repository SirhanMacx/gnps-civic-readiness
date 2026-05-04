import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { createServiceSubmission, ServiceSubmissionSchema } from '$server/submissions.js';
import { sendSupervisorConfirmation } from '$server/email.js';

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

    let result;
    try {
      result = await createServiceSubmission(parsed.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('createServiceSubmission failed:', msg, e);
      return fail(500, { error: `Save failed: ${msg}` });
    }

    // Fire the supervisor confirmation email. If Resend isn't configured (Phase 1
    // before IT provisions Resend), we surface that in the success banner so the
    // student knows to expect a follow-up via another channel — but we DO NOT
    // fail the submission. The hours_log row is saved either way and an admin
    // can re-issue the email later.
    const email = await sendSupervisorConfirmation({
      to: parsed.data.supervisorEmail,
      supervisorName: parsed.data.supervisorName,
      studentName: `${parsed.data.studentFirstName} ${parsed.data.studentLastName}`,
      studentSchool: 'Great Neck Public Schools',
      hours: parsed.data.hours,
      organization: parsed.data.organization,
      dateRange: `${parsed.data.dateStart} to ${parsed.data.dateEnd}`,
      confirmToken: result.confirmationToken
    });

    return {
      success: true,
      supervisorEmail: parsed.data.supervisorEmail,
      emailSent: email.ok,
      emailReason: email.ok ? undefined : email.reason
    };
  }
};
