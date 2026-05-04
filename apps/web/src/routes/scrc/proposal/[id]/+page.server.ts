/**
 * SCRC proposal/scoring detail loader + form actions.
 *
 * Two view modes are driven by submission status:
 *   - 'proposed'  → topic review (approve / request_revisions / reject)
 *   - 'submitted' → final scoring (score)
 *
 * Other statuses render the page in read-only mode.
 *
 * Every action funnels through the helpers in $server/scrc.ts which write
 * audit_log rows for NYSED defensibility.
 */

import { error, fail, redirect } from '@sveltejs/kit';
import { requireRole } from '$server/auth.js';
import {
  approveTopic,
  rejectTopic,
  requestProposalRevisions,
  scoreCompletedProject,
  getSubmissionDetail,
  getEvidenceLinks,
  getRubric,
  RUBRICS,
  SCRC_PATHWAY_TYPES,
  type ScrcPathway
} from '$server/scrc.js';
import type { Actions, PageServerLoad } from './$types.js';

function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw error(400, 'Invalid submission id');
  return n;
}

export const load: PageServerLoad = async (event) => {
  await requireRole(event, 'scrc_member');
  const id = parseId(event.params.id);
  const submission = await getSubmissionDetail(id);
  if (!submission) throw error(404, 'Submission not found');

  // Only project pathways are reviewed by SCRC; everything else is a 404.
  if (!(SCRC_PATHWAY_TYPES as readonly string[]).includes(submission.pathwayType)) {
    throw error(404, 'This submission is not a project pathway.');
  }

  const evidence = submission.status === 'submitted' || submission.status === 'scored'
    ? await getEvidenceLinks(id)
    : [];

  const rubric = getRubric(submission.pathwayType as ScrcPathway);

  return { submission, rubric, evidence };
};

export const actions: Actions = {
  approve: async (event) => {
    const user = await requireRole(event, 'scrc_member');
    const id = parseId(event.params.id);
    const form = await event.request.formData();
    const notes = (form.get('notes') as string | null)?.trim() || undefined;
    try {
      await approveTopic({ submissionId: id, reviewerId: user.id, notes });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'approveTopic threw';
      return fail(500, { error: msg });
    }
    throw redirect(303, '/scrc?approved=' + id);
  },

  reject: async (event) => {
    const user = await requireRole(event, 'scrc_member');
    const id = parseId(event.params.id);
    const form = await event.request.formData();
    const reason = (form.get('reason') as string | null)?.trim() ?? '';
    if (reason.length < 5) {
      return fail(400, { error: 'Provide a rejection reason (5+ chars).' });
    }
    try {
      await rejectTopic({ submissionId: id, reviewerId: user.id, reason });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'rejectTopic threw';
      return fail(500, { error: msg });
    }
    throw redirect(303, '/scrc?rejected=' + id);
  },

  request_revisions: async (event) => {
    const user = await requireRole(event, 'scrc_member');
    const id = parseId(event.params.id);
    const form = await event.request.formData();
    const notes = (form.get('notes') as string | null)?.trim() ?? '';
    if (notes.length < 5) {
      return fail(400, { error: 'Tell the student what to revise (5+ chars).' });
    }
    try {
      await requestProposalRevisions({ submissionId: id, reviewerId: user.id, notes });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'requestProposalRevisions threw';
      return fail(500, { error: msg });
    }
    throw redirect(303, '/scrc?revisions=' + id);
  },

  score: async (event) => {
    const user = await requireRole(event, 'scrc_member');
    const id = parseId(event.params.id);
    const submission = await getSubmissionDetail(id);
    if (!submission) return fail(404, { error: 'Submission not found' });
    if (submission.status !== 'submitted') {
      return fail(409, { error: `Submission must be in 'submitted' status (was ${submission.status}).` });
    }
    const pathway = submission.pathwayType as ScrcPathway;
    const rubric = RUBRICS[pathway];
    const form = await event.request.formData();

    const rubricScores: Record<string, number> = {};
    const errors: string[] = [];
    for (const c of rubric.criteria) {
      const raw = form.get(`score__${c.key}`);
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > rubric.scaleMax) {
        errors.push(c.key);
      } else {
        rubricScores[c.key] = n;
      }
    }
    if (errors.length > 0) {
      return fail(400, {
        error: `Score every criterion 1-${rubric.scaleMax}. Missing: ${errors.join(', ')}.`
      });
    }

    const notes = (form.get('notes') as string | null)?.trim() || undefined;
    try {
      const { pointsAwarded } = await scoreCompletedProject({
        submissionId: id,
        reviewerId: user.id,
        pathway,
        rubricScores,
        notes
      });
      throw redirect(303, `/scrc?scored=${id}&pts=${pointsAwarded}`);
    } catch (e) {
      // Let SvelteKit redirects propagate.
      if (e instanceof Response || (e && typeof e === 'object' && 'status' in e && 'location' in e)) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : 'scoreCompletedProject threw';
      return fail(500, { error: msg });
    }
  }
};
