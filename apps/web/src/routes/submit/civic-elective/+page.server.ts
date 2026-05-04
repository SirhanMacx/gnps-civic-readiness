import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { createCivicElectiveEssay, CivicElectiveEssaySchema } from '$server/submissions.js';
import { sendStudentProgressEmail } from '$server/student-progress-email.js';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const essay = form.get('essayFile');
    if (!(essay instanceof File) || essay.size === 0) {
      return fail(400, { error: 'Essay file is required (PDF or DOCX).' });
    }
    if (essay.size > MAX_BYTES) {
      return fail(400, { error: `File too large (${Math.round(essay.size / 1024 / 1024)} MB). Max 8 MB.` });
    }
    if (essay.type && !ALLOWED_MIME.has(essay.type)) {
      return fail(400, { error: `File type ${essay.type} not accepted. Upload a PDF or DOCX.` });
    }
    const fileBytes = new Uint8Array(await essay.arrayBuffer());

    const parsed = CivicElectiveEssaySchema.safeParse({
      studentId: form.get('studentId'),
      studentLastName: form.get('studentLastName'),
      studentFirstName: form.get('studentFirstName'),
      studentEmail: form.get('studentEmail') ?? '',
      gradYear: Number(form.get('gradYear')),
      courseCode: form.get('courseCode'),
      courseYear: form.get('courseYear'),
      fileName: essay.name,
      fileMimeType: essay.type || 'application/octet-stream',
      fileBytes
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.errors[0]?.message ?? 'Invalid input' });
    }
    try {
      const result = await createCivicElectiveEssay(parsed.data);
      let progressSent = false;
      if (parsed.data.studentEmail) {
        const r = await sendStudentProgressEmail({
          studentId: parsed.data.studentId,
          studentEmail: parsed.data.studentEmail,
          studentFirstName: parsed.data.studentFirstName,
          studentLastName: parsed.data.studentLastName,
          justSubmittedPathway: 'civic_elective_essay'
        });
        progressSent = r.ok;
      }
      return {
        success: true,
        submissionId: result.submissionId,
        storagePath: result.storagePath,
        storageWarning: result.storageWarning ?? null,
        fileName: parsed.data.fileName,
        studentEmail: parsed.data.studentEmail || undefined,
        studentProgressSent: progressSent
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('createCivicElectiveEssay failed:', msg, e);
      return fail(500, { error: `Save failed: ${msg}` });
    }
  }
};
