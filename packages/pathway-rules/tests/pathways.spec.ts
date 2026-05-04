import { describe, expect, it } from 'vitest';
import { PATHWAYS, columnOf, capOf, type PathwayId } from '../src/pathways.js';

describe('PATHWAYS registry', () => {
  it('lists all 11 NYSED pathways', () => {
    expect(PATHWAYS.length).toBe(11);
  });

  it('keys every pathway by name (not letter), with unique ids', () => {
    const ids = PATHWAYS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Spot-check a few canonical name keys.
    expect(ids).toContain('hs_capstone');
    expect(ids).toContain('ms_capstone');
    expect(ids).toContain('service_learning');
  });

  it('classifies hs_civic_project under participation column', () => {
    expect(columnOf('hs_civic_project')).toBe('participation');
  });

  it('classifies four_ss_credits under knowledge column', () => {
    expect(columnOf('four_ss_credits')).toBe('knowledge');
  });

  it('caps hs_civic_project at 3 points (2 instances)', () => {
    expect(capOf('hs_civic_project')).toEqual({ maxInstances: 2, maxPoints: 3 });
  });

  it('does not cap service_learning (repeatable, no cap)', () => {
    expect(capOf('service_learning')).toBeNull();
  });

  it('caps hs_capstone at 4 points (1 instance)', () => {
    expect(capOf('hs_capstone')).toEqual({ maxInstances: 1, maxPoints: 4 });
  });

  it('throws on unknown columnOf id', () => {
    expect(() => columnOf('not_a_real_pathway' as PathwayId)).toThrow();
  });

  it('throws on unknown capOf id', () => {
    expect(() => capOf('also_fake' as PathwayId)).toThrow();
  });
});
