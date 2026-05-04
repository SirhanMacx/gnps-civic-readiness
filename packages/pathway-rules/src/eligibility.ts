/**
 * Seal-of-Civic-Readiness eligibility predicate.
 *
 * Per spec §4.3 and §1.2: a student is eligible when their cumulative
 * point totals satisfy ALL three conditions:
 *   - knowledge column   ≥ 2
 *   - participation column ≥ 2
 *   - total              ≥ 6
 *
 * Eligibility is *not* the same as awarded — a counselor still has to
 * confirm the eligible state to advance the student to `awarded`. This
 * function only computes the gate, not the workflow transition.
 */

import type { PointTotals } from './points.js';

const MIN_KNOWLEDGE = 2;
const MIN_PARTICIPATION = 2;
const MIN_TOTAL = 6;

export function isEligible(p: PointTotals): boolean {
  return (
    p.knowledge >= MIN_KNOWLEDGE &&
    p.participation >= MIN_PARTICIPATION &&
    p.total >= MIN_TOTAL
  );
}
