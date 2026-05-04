/**
 * SCRC dashboard loader. Two queues + an awarded count.
 *
 * Note: requireRole('scrc_member') is already applied by +layout.server.ts;
 * we re-apply here for defense-in-depth so direct page-load helpers don't
 * skip the gate.
 */

import { requireRole } from '$server/auth.js';
import {
  countAwardedProjects,
  listProposalQueue,
  listScoringQueue
} from '$server/scrc.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async (event) => {
  await requireRole(event, 'scrc_member');
  const [proposalQueue, scoringQueue, awardedCount] = await Promise.all([
    listProposalQueue(),
    listScoringQueue(),
    countAwardedProjects()
  ]);
  return { proposalQueue, scoringQueue, awardedCount };
};
