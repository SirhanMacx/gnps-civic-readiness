import type { Actions } from './$types.js';
import { fail, redirect } from '@sveltejs/kit';
import { requireRole } from '$server/auth.js';
import { teacherPush, TeacherPushSchema, type TeacherPushInput } from '$server/teacher-push.js';

export const actions: Actions = {
  default: async (event) => {
    // Allow teacher / scrc_member / admin. Counselors should use the approval queue.
    const user =
      (await requireRole(event, 'teacher').catch(() => null)) ??
      (await requireRole(event, 'scrc_member').catch(() => null)) ??
      (await requireRole(event, 'admin'));

    const form = await event.request.formData();
    const rawIds = String(form.get('studentIds') ?? '');
    const studentIds = rawIds
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const domainTags = form.getAll('domainTags').map(String);

    const parsed = TeacherPushSchema.safeParse({
      pathwayType: form.get('pathwayType'),
      studentIds,
      pointsAwarded: Number(form.get('pointsAwarded')),
      notes: form.get('notes') ?? '',
      domainTags,
      classLabel: form.get('classLabel') ?? ''
    } satisfies TeacherPushInput);

    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.errors[0]?.message ?? 'Invalid input',
        success: false
      });
    }

    try {
      const result = await teacherPush(parsed.data, {
        id: user.id,
        email: user.email,
        fullName: user.fullName ?? user.email,
        role: user.role as 'teacher' | 'counselor' | 'scrc_member' | 'admin'
      });
      return {
        success: true as const,
        pushedCount: result.pushedCount,
        status: result.status,
        rejected: result.rejected
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('teacherPush failed:', msg, e);
      return fail(500, { error: `Push failed: ${msg}`, success: false });
    }
  }
};
