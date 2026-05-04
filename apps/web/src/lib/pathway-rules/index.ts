/**
 * @gnps-civic/pathway-rules — public surface.
 *
 * Pure NYSED Seal-of-Civic-Readiness point-computation logic. No Supabase,
 * no SvelteKit, no I/O. Consumed by the web app's load functions and by
 * the CSV-import path so the same numbers fall out everywhere.
 */

export {
  PATHWAYS,
  columnOf,
  capOf,
  type Column,
  type Pathway,
  type PathwayCap,
  type PathwayId,
} from './pathways.js';

export {
  computePoints,
  type AwardedSubmission,
  type PointTotals,
  type RegentsScore,
  type StudentEvidence,
} from './points.js';

export { isEligible } from './eligibility.js';
