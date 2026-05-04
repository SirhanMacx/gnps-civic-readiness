/**
 * Counselor approval queue load + form actions.
 *
 * Surfaces all pathway_submissions in 'submitted' or 'scored' status for
 * the logged-in counselor's caseload. Each item exposes three POST actions:
 *   - approve  → counselor-approves with a numeric `points` value
 *   - revise   → bounces back to 'in_progress' with required `notes`
 *   - decline  → marks 'rejected' with required `reason`
 */

import { fail } from '@sveltejs/kit';
import { requireRole } from '$server/auth.js';
import {
  approveSubmission,
  declineSubmission,
  listApprovalQueue,
  requestRevision,
  type ApprovalQueueItem,
} from '$server/approvals.js';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async (event) => {
  const user = await requireRole(event, 'counselor');
  const items = await listApprovalQueue({ counselorId: user.id });
  return { items: items as ApprovalQueueItem[] };
};

function parseSubmissionId(form: FormData): number | null {
  const raw = form.get('submissionId');
  if (typeof raw !== 'string') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export const actions: Actions = {
  approve: async (event) => {
    const user = await requireRole(event, 'counselor');
    const form = await event.request.formData();
    const submissionId = parseSubmissionId(form);
    if (submissionId === null) {
      return fail(400, { error: 'Missing submissionId', action: 'approve' });
    }
    const pointsRaw = form.get('points');
    const points = pointsRaw === null ? NaN : Number(pointsRaw);
    if (!Number.isFinite(points) || points < 0) {
      return fail(400, {
        error: 'Points must be a non-negative number',
        submissionId,
        action: 'approve',
      });
    }
    const notes = (form.get('notes') as string | null) ?? undefined;

    try {
      await approveSubmission({
        submissionId,
        approverId: user.id,
        points,
        notes: notes || undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail(500, { error: msg, submissionId, action: 'approve' });
    }
    return { success: true, submissionId, action: 'approve' as const };
  },

  revise: async (event) => {
    const user = await requireRole(event, 'counselor');
    const form = await event.request.formData();
    const submissionId = parseSubmissionId(form);
    if (submissionId === null) {
      return fail(400, { error: 'Missing submissionId', action: 'revise' });
    }
    const notes = (form.get('notes') as string | null) ?? '';
    if (!notes.trim()) {
      return fail(400, {
        error: 'Revision notes are required',
        submissionId,
        action: 'revise',
      });
    }

    try {
      await requestRevision({
        submissionId,
        approverId: user.id,
        notes: notes.trim(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail(500, { error: msg, submissionId, action: 'revise' });
    }
    return { success: true, submissionId, action: 'revise' as const };
  },

  decline: async (event) => {
    const user = await requireRole(event, 'counselor');
    const form = await event.request.formData();
    const submissionId = parseSubmissionId(form);
    if (submissionId === null) {
      return fail(400, { error: 'Missing submissionId', action: 'decline' });
    }
    const reason = (form.get('reason') as string | null) ?? '';
    if (!reason.trim()) {
      return fail(400, {
        error: 'Decline reason is required',
        submissionId,
        action: 'decline',
      });
    }

    try {
      await declineSubmission({
        submissionId,
        approverId: user.id,
        reason: reason.trim(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail(500, { error: msg, submissionId, action: 'decline' });
    }
    return { success: true, submissionId, action: 'decline' as const };
  },
};
