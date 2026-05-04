/**
 * /admin/courses — course catalog editor.
 *
 * Actions:
 *   - 'add'     : insert new course (admin)
 *   - 'edit'    : partial update (admin)
 *   - 'approve' : flip scrc_approved=true (SCRC only — fails 403 if not)
 */

import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { addCourse, approveCourse, editCourse, listCourses } from '$server/courses.js';
import { requireRole } from '$server/auth.js';

export const load: PageServerLoad = async () => {
  const courses = await listCourses();
  return { courses };
};

export const actions: Actions = {
  add: async (event) => {
    const user = await requireRole(event, 'admin');
    const fd = await event.request.formData();
    const courseCode = String(fd.get('courseCode') ?? '').trim();
    const title = String(fd.get('title') ?? '').trim();
    const credits = Number(fd.get('credits') ?? 1);
    const countsForRaw = String(fd.get('countsFor') ?? '');
    const countsFor = countsForRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!courseCode || !title) {
      return fail(400, { addError: 'course_code and title are required' });
    }
    try {
      const course = await addCourse({
        courseCode,
        title,
        credits,
        countsFor,
        addedBy: user.id
      });
      return { added: course };
    } catch (e) {
      return fail(400, {
        addError: e instanceof Error ? e.message : 'add failed'
      });
    }
  },

  edit: async (event) => {
    const user = await requireRole(event, 'admin');
    const fd = await event.request.formData();
    const courseId = Number(fd.get('courseId'));
    if (!Number.isInteger(courseId)) return fail(400, { editError: 'invalid courseId' });
    const updates: {
      courseCode?: string;
      title?: string;
      countsFor?: string[];
      credits?: number;
    } = {};
    const codeRaw = fd.get('courseCode');
    if (typeof codeRaw === 'string' && codeRaw.trim()) updates.courseCode = codeRaw.trim();
    const titleRaw = fd.get('title');
    if (typeof titleRaw === 'string' && titleRaw.trim()) updates.title = titleRaw.trim();
    const creditsRaw = fd.get('credits');
    if (typeof creditsRaw === 'string' && creditsRaw.trim()) {
      const n = Number(creditsRaw);
      if (Number.isFinite(n)) updates.credits = n;
    }
    const countsForRaw = fd.get('countsFor');
    if (typeof countsForRaw === 'string') {
      updates.countsFor = countsForRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    try {
      const course = await editCourse({ courseId, updates, editorId: user.id });
      return { edited: course };
    } catch (e) {
      return fail(400, {
        editError: e instanceof Error ? e.message : 'edit failed'
      });
    }
  },

  approve: async (event) => {
    // Approval is SCRC-only. We don't gate the route layout (admin
    // landing page expects to surface the affordance), but we do enforce
    // here.
    const user = event.locals.user;
    if (!user) {
      return fail(401, { approveError: 'not logged in' });
    }
    if (user.role !== 'scrc_member') {
      return fail(403, {
        approveError: 'Only SCRC committee members can approve courses'
      });
    }
    const fd = await event.request.formData();
    const courseId = Number(fd.get('courseId'));
    if (!Number.isInteger(courseId)) return fail(400, { approveError: 'invalid courseId' });
    try {
      const course = await approveCourse({
        courseId,
        approverId: user.id,
        approverRole: user.role
      });
      return { approved: course };
    } catch (e) {
      return fail(400, {
        approveError: e instanceof Error ? e.message : 'approve failed'
      });
    }
  }
};
