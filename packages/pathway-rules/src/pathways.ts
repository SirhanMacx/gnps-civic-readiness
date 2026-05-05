/**
 * NYSED Seal of Civic Readiness — pathway registry.
 *
 * Pathways are keyed by *name*, not by NYSED letter labels. The single-page
 * NYSED Criteria PDF and the full Handbook disagree on the letter labels for
 * the participation pathways (e.g. MS Capstone is "2d" in one and "2e" in the
 * other). To avoid silent drift, this module sources truth from name keys.
 *
 * NYSED reference table — see spec §1.2:
 *   1a four_ss_credits      knowledge      1.0   SIS-derived, max 1, 1pt cap
 *   1b regents_mastery      knowledge      1.5   SIS-derived, repeatable, no cap
 *   1c regents_proficiency  knowledge      1.0   SIS-derived, repeatable, no cap
 *   1d advanced_ss_course   knowledge      0.5   SIS-derived, repeatable, no cap
 *   1e research_project     knowledge      1.0   non-SIS, max 1, 1pt cap
 *   2a hs_civic_project     participation  1.5   non-SIS, max 2, 3pt cap
 *   2b service_learning     participation  1.0   non-SIS, repeatable, no cap
 *   2c civic_elective       participation  0.5   SIS-derived (+ essay), repeatable, no cap
 *   2d ms_capstone          participation  1.0   non-SIS, max 1, 1pt cap (grades 7-8 only)
 *   2e wbl_extracurr        participation  0.5   non-SIS, repeatable, no cap
 *   2f hs_capstone          participation  4.0   non-SIS, max 1, 4pt cap
 */

export type PathwayId =
  | 'four_ss_credits' // 1a — 4 credits of social studies
  | 'regents_mastery' // 1b — Regents ≥85 on Global II or US History
  | 'regents_proficiency' // 1c — Regents 65-84 (or approved safety-net / 45-variance)
  | 'advanced_ss_course' // 1d — Honors / Pre-AP / AP / IB / dual-enrollment
  | 'research_project' // 1e — civic-knowledge research project
  | 'hs_civic_project' // 2a — high school civic project (max 2, 3pt cap)
  | 'service_learning' // 2b — ≥25 hrs + reflection (5-stage process)
  | 'civic_elective' // 2c — civic-engagement elective (proficiency + essay)
  | 'ms_capstone' // 2d — middle school capstone (grades 7-8)
  | 'wbl_extracurr' // 2e — extracurricular or work-based learning
  | 'hs_capstone'; // 2f — high school civics capstone (4 points)

export type Column = 'knowledge' | 'participation';

export interface PathwayCap {
  readonly maxInstances: number;
  readonly maxPoints: number;
}

export interface Pathway {
  readonly id: PathwayId;
  readonly column: Column;
  readonly pointsEach: number;
  readonly cap: PathwayCap | null;
  /**
   * `true` → no row in `pathway_submissions`; computed from
   * course_enrollment + regents_scores at read time. `civic_elective` is
   * marked `true` because the proficiency-grade component is SIS-derived;
   * the application-of-knowledge essay component is stored as a
   * `civic_elective_essay` submission row but only contributes when paired
   * with a passing course grade for the same year (see spec §4.2).
   */
  readonly sisDerived: boolean;
}

export const PATHWAYS: readonly Pathway[] = [
  {
    id: 'four_ss_credits',
    column: 'knowledge',
    pointsEach: 1,
    cap: { maxInstances: 1, maxPoints: 1 },
    sisDerived: true,
  },
  {
    id: 'regents_mastery',
    column: 'knowledge',
    pointsEach: 1.5,
    cap: null,
    sisDerived: true,
  },
  {
    id: 'regents_proficiency',
    column: 'knowledge',
    pointsEach: 1,
    cap: null,
    sisDerived: true,
  },
  {
    id: 'advanced_ss_course',
    column: 'knowledge',
    pointsEach: 0.5,
    cap: null,
    sisDerived: true,
  },
  {
    id: 'research_project',
    column: 'knowledge',
    pointsEach: 1,
    cap: { maxInstances: 1, maxPoints: 1 },
    sisDerived: false,
  },
  {
    id: 'hs_civic_project',
    column: 'participation',
    pointsEach: 1.5,
    cap: { maxInstances: 2, maxPoints: 3 },
    sisDerived: false,
  },
  {
    id: 'service_learning',
    column: 'participation',
    pointsEach: 1,
    cap: null,
    sisDerived: false,
  },
  {
    id: 'civic_elective',
    column: 'participation',
    pointsEach: 0.5,
    cap: null,
    sisDerived: true,
  },
  {
    id: 'ms_capstone',
    column: 'participation',
    pointsEach: 1,
    cap: { maxInstances: 1, maxPoints: 1 },
    sisDerived: false,
  },
  {
    id: 'wbl_extracurr',
    column: 'participation',
    pointsEach: 0.5,
    cap: null,
    sisDerived: false,
  },
  {
    id: 'hs_capstone',
    column: 'participation',
    pointsEach: 4,
    cap: { maxInstances: 1, maxPoints: 4 },
    sisDerived: false,
  },
] as const;

function findPathway(id: PathwayId): Pathway {
  const p = PATHWAYS.find((entry) => entry.id === id);
  if (!p) throw new Error(`unknown pathway: ${id}`);
  return p;
}

export function columnOf(id: PathwayId): Column {
  return findPathway(id).column;
}

export function capOf(id: PathwayId): PathwayCap | null {
  return findPathway(id).cap;
}
