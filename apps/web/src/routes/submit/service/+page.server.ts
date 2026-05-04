import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { createServiceSubmission, ServiceSubmissionSchema } from '$server/submissions.js';
import { sendSupervisorConfirmation } from '$server/email.js';
import { sendStudentProgressEmail } from '$server/student-progress-email.js';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const parsed = ServiceSubmissionSchema.safeParse({
      studentId: form.get('studentId'),
      studentLastName: form.get('studentLastName'),
      studentFirstName: form.get('studentFirstName'),
      studentEmail: form.get('studentEmail') ?? '',
      gradYear: Number(form.get('gradYear')),
      activityName: form.get('activityName'),
      organization: form.get('activityName'),
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

    // 1. Supervisor confirmation email (existing flow)
    const supervisorEmail = await sendSupervisorConfirmation({
      to: parsed.data.supervisorEmail,
      supervisorName: parsed.data.supervisorName,
      studentName: `${parsed.data.studentFirstName} ${parsed.data.studentLastName}`,
      studentSchool: 'Great Neck Public Schools',
      hours: parsed.data.hours,
      organization: parsed.data.organization,
      dateRange: `${parsed.data.dateStart} to ${parsed.data.dateEnd}`,
      confirmToken: result.confirmationToken
    });

    // 2. Student progress report email (new) — fires only if student supplied an email
    let studentProgressSent = false;
    if (parsed.data.studentEmail) {
      const progress = await sendStudentProgressEmail({
        studentId: parsed.data.studentId,
        studentEmail: parsed.data.studentEmail,
        studentFirstName: parsed.data.studentFirstName,
        studentLastName: parsed.data.studentLastName,
        justSubmittedPathway: 'service_learning'
      });
      studentProgressSent = progress.ok;
    }

    return {
      success: true,
      supervisorEmail: parsed.data.supervisorEmail,
      emailSent: supervisorEmail.ok,
      emailReason: supervisorEmail.ok ? undefined : supervisorEmail.reason,
      studentEmail: parsed.data.studentEmail || undefined,
      studentProgressSent
    };
  }
};
