/**
 * NYSED Seal of Civic Readiness — point computation engine.
 *
 * Pure function: given a snapshot of all student evidence (SIS-derived
 * facts + reviewer-awarded submission outcomes), produce the column totals.
 *
 * SIS-derived rules (spec §1.2 + §4.3):
 *   - 1a: ssCreditsPassed ≥ 4 → +1 knowledge (one-shot)
 *   - 1b: each Regents ≥ 85 → +1.5 knowledge
 *   - 1c: each Regents 65-84 → +1 knowledge
 *         each Regents 45-64 with safetyNet=true → +1 knowledge
 *   - 1d: advancedSsCount × 0.5 knowledge
 *
 * Awarded-submission rules:
 *   - Group `awarded[]` by pathway id, sum the per-instance points
 *   - Apply the per-pathway cap (e.g. hs_civic_project caps at 3)
 *   - Route to the column declared in the registry (knowledge|participation)
 */

import { capOf, columnOf, type PathwayId } from './pathways.js';

export interface RegentsScore {
  readonly exam: 'GLOBAL_II' | 'US_HISTORY';
  readonly score: number;
  /**
   * IEP/504 safety-net, special-appeal, or 45-variance flag. When true,
   * a score in the 45-64 range counts as proficiency (NYSED FAQ).
   */
  readonly safetyNet: boolean;
}

export interface AwardedSubmission {
  readonly pathway: PathwayId;
  readonly points: number;
}

export interface StudentEvidence {
  /** Total SS credits passed (Global I/II, US History, Participation in Gov). */
  readonly ssCreditsPassed: number;
  /** All Regents Global II / US History attempts on record. */
  readonly regents: readonly RegentsScore[];
  /** Count of advanced SS courses (Honors / Pre-AP / AP / IB / dual). */
  readonly advancedSsCount: number;
  /** Per-instance awarded submission points (counselor/SCRC-confirmed). */
  readonly awarded: readonly AwardedSubmission[];
}

export interface PointTotals {
  readonly knowledge: number;
  readonly participation: number;
  readonly total: number;
}

const REGENTS_MASTERY_THRESHOLD = 85;
const REGENTS_PROFICIENCY_THRESHOLD = 65;
const REGENTS_SAFETY_NET_THRESHOLD = 45;

export function computePoints(ev: StudentEvidence): PointTotals {
  let knowledge = 0;
  let participation = 0;

  // 1a — 4 social-studies credits passed.
  if (ev.ssCreditsPassed >= 4) {
    knowledge += 1;
  }

  // 1d — advanced SS courses.
  knowledge += ev.advancedSsCount * 0.5;

  // 1b/1c — Regents (mastery / proficiency / safety-net).
  for (const r of ev.regents) {
    if (r.score >= REGENTS_MASTERY_THRESHOLD) {
      knowledge += 1.5;
    } else if (r.score >= REGENTS_PROFICIENCY_THRESHOLD) {
      knowledge += 1;
    } else if (r.safetyNet && r.score >= REGENTS_SAFETY_NET_THRESHOLD) {
      knowledge += 1;
    }
  }

  // Group awarded submission points by pathway, then apply the per-pathway
  // cap, then route to the correct column. We have to group first because
  // caps are aggregate (e.g. hs_civic_project max 3 across instances).
  const grouped = new Map<PathwayId, number>();
  for (const a of ev.awarded) {
    grouped.set(a.pathway, (grouped.get(a.pathway) ?? 0) + a.points);
  }

  for (const [pathway, raw] of grouped) {
    const cap = capOf(pathway);
    const capped = cap === null ? raw : Math.min(raw, cap.maxPoints);
    if (columnOf(pathway) === 'knowledge') {
      knowledge += capped;
    } else {
      participation += capped;
    }
  }

  return { knowledge, participation, total: knowledge + participation };
}
