/**
 * Per-student detail page load.
 *
 * Returns the StudentDetail bundle assembled by getStudentDetail() — totals,
 * awarded + pending submissions, regents, course enrollment, audit excerpt.
 *
 * 404 if the student id doesn't exist. Future: 403 if the counselor is not
 * the assigned counselor for this student (Phase 1: counselors can view any
 * student in their district per the spec; the caseload filter is a default,
 * not a hard wall).
 */

import { error } from '@sveltejs/kit';
import { requireRole } from '$server/auth.js';
import { getStudentDetail, type StudentDetail } from '$server/student-detail.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async (event) => {
  await requireRole(event, 'counselor');
  const detail = await getStudentDetail(event.params.id);
  if (!detail) {
    throw error(404, `No student with id ${event.params.id}`);
  }
  return { detail: detail as StudentDetail };
};
