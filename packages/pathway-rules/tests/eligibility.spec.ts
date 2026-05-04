import { describe, expect, it } from 'vitest';
import { isEligible } from '../src/eligibility.js';

describe('isEligible', () => {
  it('not eligible at 5.5 total (total < 6)', () => {
    expect(isEligible({ knowledge: 2, participation: 3.5, total: 5.5 })).toBe(false);
  });

  it('not eligible at 1.5 knowledge even with 6 total', () => {
    expect(isEligible({ knowledge: 1.5, participation: 4.5, total: 6 })).toBe(false);
  });

  it('not eligible at 1.5 participation even with 6 total', () => {
    expect(isEligible({ knowledge: 4.5, participation: 1.5, total: 6 })).toBe(false);
  });

  it('eligible at exactly 2 / 4 / 6', () => {
    expect(isEligible({ knowledge: 2, participation: 4, total: 6 })).toBe(true);
  });

  it('eligible above the bar (3 / 5 / 8)', () => {
    expect(isEligible({ knowledge: 3, participation: 5, total: 8 })).toBe(true);
  });

  it('not eligible at 0/0/0', () => {
    expect(isEligible({ knowledge: 0, participation: 0, total: 0 })).toBe(false);
  });

  it('eligible at the spec example total (3.5 / 5 / 8.5)', () => {
    // 4SS + mastery Regents + proficiency Regents + service-learning + capstone.
    expect(isEligible({ knowledge: 3.5, participation: 5, total: 8.5 })).toBe(true);
  });
});
