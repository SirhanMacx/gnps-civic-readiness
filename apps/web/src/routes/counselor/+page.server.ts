/**
 * Counselor dashboard load — fetches the caseload roster and rollup counts.
 *
 * The +layout.server.ts gate has already verified `counselor` role and put
 * the StaffUser in `data.user`. We use `event.locals.user.id` to filter the
 * roster down to that counselor's caseload (students.counselor_id match).
 */

import { requireRole } from '$server/auth.js';
import { getCohortRoster, type RosterRow } from '$server/roster.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async (event) => {
  const user = await requireRole(event, 'counselor');
  const roster = await getCohortRoster({ counselorId: user.id });

  const eligibleCount = roster.filter((r) => r.eligible && r.status !== 'awarded').length;
  const awardedCount = roster.filter((r) => r.status === 'awarded').length;
  const pendingCount = roster.filter(
    (r) => r.status !== 'awarded' && !r.eligible,
  ).length;

  return {
    roster: roster as RosterRow[],
    eligibleCount,
    awardedCount,
    pendingCount,
  };
};
