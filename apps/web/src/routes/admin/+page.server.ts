/**
 * Admin landing page loader. Returns:
 *
 *   - the full unfiltered roster with computed eligibility/points
 *   - aggregate metric counts (eligible / awarded / total)
 *   - a list of grad years present in the cohort (for the filter dropdown)
 *   - the most recent CSV imports for the activity panel
 */

import type { PageServerLoad } from './$types.js';
import { loadCohort } from "$server/cohort.js";
import { listRecentImports, type RecentImport } from '$server/imports.js';

export interface AdminRosterRow {
  id: string;
  lastName: string;
  firstName: string;
  gradYear: number;
  status: string;
  knowledge: number;
  participation: number;
  total: number;
  eligible: boolean;
}

export const load: PageServerLoad = async () => {
  const cohort = await loadCohort();
  const roster: AdminRosterRow[] = cohort.students.map((s) => ({
    id: s.id,
    lastName: s.lastName,
    firstName: s.firstName,
    gradYear: s.gradYear,
    status: s.status,
    knowledge: s.knowledge,
    participation: s.participation,
    total: s.total,
    eligible: s.eligible
  }));

  const totals = {
    totalStudents: roster.length,
    eligible: roster.filter((r) => r.eligible).length,
    awarded: roster.filter((r) => r.status === 'awarded').length
  };

  const gradYearsToShow = Array.from(new Set(roster.map((r) => r.gradYear))).sort(
    (a, b) => a - b
  );

  let recentImports: RecentImport[] = [];
  try {
    recentImports = await listRecentImports(5);
  } catch {
    // audit_log read is best-effort here.
  }

  return { roster, totals, gradYearsToShow, recentImports };
};
