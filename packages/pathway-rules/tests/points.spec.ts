import { describe, expect, it } from 'vitest';
import { computePoints, type StudentEvidence } from '../src/points.js';

const empty: StudentEvidence = {
  ssCreditsPassed: 0,
  regents: [],
  advancedSsCount: 0,
  awarded: [],
};

describe('computePoints — knowledge column (SIS-derived)', () => {
  it('awards 1pt for 4 SS credits passed', () => {
    const ev: StudentEvidence = { ...empty, ssCreditsPassed: 4 };
    const result = computePoints(ev);
    expect(result.knowledge).toBe(1);
    expect(result.participation).toBe(0);
    expect(result.total).toBe(1);
  });

  it('does not award the 4-credit point at 3 credits', () => {
    expect(computePoints({ ...empty, ssCreditsPassed: 3 }).knowledge).toBe(0);
  });

  it('awards 1.5pt mastery + 1pt proficiency for two Regents', () => {
    const ev: StudentEvidence = {
      ...empty,
      regents: [
        { exam: 'GLOBAL_II', score: 87, safetyNet: false },
        { exam: 'US_HISTORY', score: 72, safetyNet: false },
      ],
    };
    expect(computePoints(ev).knowledge).toBe(2.5);
  });

  it('awards 1pt for safety-net Regents pass at 60', () => {
    const ev: StudentEvidence = {
      ...empty,
      regents: [{ exam: 'GLOBAL_II', score: 60, safetyNet: true }],
    };
    expect(computePoints(ev).knowledge).toBe(1);
  });

  it('does not award for non-safety-net 60', () => {
    const ev: StudentEvidence = {
      ...empty,
      regents: [{ exam: 'GLOBAL_II', score: 60, safetyNet: false }],
    };
    expect(computePoints(ev).knowledge).toBe(0);
  });

  it('awards 1pt for an approved 45-variance Regents score', () => {
    const ev: StudentEvidence = {
      ...empty,
      regents: [{ exam: 'GLOBAL_II', score: 45, safetyNet: true }],
    };
    expect(computePoints(ev).knowledge).toBe(1);
  });

  it('does not award for safety-net/variance below 45', () => {
    const ev: StudentEvidence = {
      ...empty,
      regents: [{ exam: 'GLOBAL_II', score: 44, safetyNet: true }],
    };
    expect(computePoints(ev).knowledge).toBe(0);
  });

  it('awards 0.5pt per advanced SS course (3 → 1.5pt)', () => {
    expect(computePoints({ ...empty, advancedSsCount: 3 }).knowledge).toBe(1.5);
  });
});

describe('computePoints — participation column (awarded with caps)', () => {
  it('caps hs_civic_project at 3 points even with 3 instances of 1.5', () => {
    const ev: StudentEvidence = {
      ...empty,
      awarded: [
        { pathway: 'hs_civic_project', points: 1.5 },
        { pathway: 'hs_civic_project', points: 1.5 },
        { pathway: 'hs_civic_project', points: 1.5 }, // raw 4.5; cap = 3
      ],
    };
    expect(computePoints(ev).participation).toBe(3);
  });

  it('hs_capstone alone gives 4pt participation', () => {
    const ev: StudentEvidence = {
      ...empty,
      awarded: [{ pathway: 'hs_capstone', points: 4 }],
    };
    expect(computePoints(ev).participation).toBe(4);
    expect(computePoints(ev).knowledge).toBe(0);
  });

  it('service_learning is uncapped — 4 instances aggregate', () => {
    const ev: StudentEvidence = {
      ...empty,
      awarded: [
        { pathway: 'service_learning', points: 1 },
        { pathway: 'service_learning', points: 1 },
        { pathway: 'service_learning', points: 1 },
        { pathway: 'service_learning', points: 1 },
      ],
    };
    expect(computePoints(ev).participation).toBe(4);
  });

  it('routes research_project to knowledge column', () => {
    const ev: StudentEvidence = {
      ...empty,
      awarded: [{ pathway: 'research_project', points: 1 }],
    };
    const r = computePoints(ev);
    expect(r.knowledge).toBe(1);
    expect(r.participation).toBe(0);
  });
});

describe('computePoints — totals', () => {
  it('returns total = knowledge + participation', () => {
    const ev: StudentEvidence = {
      ssCreditsPassed: 4, // 1pt knowledge
      regents: [{ exam: 'GLOBAL_II', score: 90, safetyNet: false }], // 1.5pt knowledge
      advancedSsCount: 0,
      awarded: [
        { pathway: 'service_learning', points: 1 }, // 1pt participation
        { pathway: 'hs_capstone', points: 4 }, // 4pt participation
      ],
    };
    const r = computePoints(ev);
    expect(r.knowledge).toBe(2.5);
    expect(r.participation).toBe(5);
    expect(r.total).toBe(7.5);
  });

  it('end-to-end: 4SS + 2 Regents + service-learning + capstone → 8.5 total', () => {
    // 4 SS (1) + mastery Regents (1.5) + proficiency Regents (1)
    // + service_learning (1) + hs_capstone (4) = 8.5 total.
    const ev: StudentEvidence = {
      ssCreditsPassed: 4,
      regents: [
        { exam: 'GLOBAL_II', score: 92, safetyNet: false },
        { exam: 'US_HISTORY', score: 78, safetyNet: false },
      ],
      advancedSsCount: 0,
      awarded: [
        { pathway: 'service_learning', points: 1 },
        { pathway: 'hs_capstone', points: 4 },
      ],
    };
    const r = computePoints(ev);
    expect(r.knowledge).toBe(3.5);
    expect(r.participation).toBe(5);
    expect(r.total).toBe(8.5);
  });
});
