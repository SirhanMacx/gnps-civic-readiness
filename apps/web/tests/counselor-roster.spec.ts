/**
 * Tests for the counselor roster pipeline.
 *
 * Covers:
 *   1. Pure transform: buildStudentEvidence correctly maps SIS rows + awarded
 *      submission rows into the StudentEvidence shape used by pathway-rules,
 *      and computePoints + isEligible give the expected output.
 *   2. End-to-end: getCohortRoster against a mocked supabaseAdmin client —
 *      empty cohort, six-point eligible student, knowledge-low student.
 *
 * The Supabase admin client is mocked so we don't hit the network; the
 * mock returns canned rows for each `from(table)` call.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computePoints, isEligible } from '$lib/pathway-rules/index.js';

// --- Supabase admin mock --------------------------------------------------

interface MockTable {
  rows: any[];
  /** Optional error to surface from the .select() chain. */
  error?: { message: string } | null;
}

// Mutable canned-data registry. Keys are table names.
const tableState: Record<string, MockTable> = {
  students: { rows: [] },
  course_enrollment: { rows: [] },
  regents_scores: { rows: [] },
  pathway_submissions: { rows: [] },
};

function buildBuilder(table: string) {
  // The roster query chains: .select(...).order(...).eq(...).in(...) — all
  // chainable. We model each step as a thenable that resolves to the rows.
  // Filters are applied client-side against tableState[table].rows.
  let rows = tableState[table]?.rows ?? [];
  const err = tableState[table]?.error ?? null;

  const builder: any = {
    _filters: [] as Array<(r: any) => boolean>,
    select(_cols: string) {
      return builder;
    },
    eq(col: string, val: any) {
      builder._filters.push((r: any) => r[col] === val);
      return builder;
    },
    in(col: string, vals: any[]) {
      builder._filters.push((r: any) => vals.includes(r[col]));
      return builder;
    },
    order(_col: string, _opts: any) {
      return builder;
    },
    or(_expr: string) {
      return builder;
    },
    limit(_n: number) {
      return builder;
    },
    maybeSingle() {
      const filtered = rows.filter((r) => builder._filters.every((f: any) => f(r)));
      return Promise.resolve({ data: filtered[0] ?? null, error: err });
    },
    then(onF: any, onR: any) {
      const filtered = rows.filter((r) => builder._filters.every((f: any) => f(r)));
      return Promise.resolve({ data: filtered, error: err }).then(onF, onR);
    },
  };
  return builder;
}

vi.mock('$server/supabase.js', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => buildBuilder(table),
  }),
}));

vi.mock('$env/dynamic/private', () => ({
  env: { SUPABASE_SERVICE_ROLE_KEY: 'srk-test' },
}));
vi.mock('$env/dynamic/public', () => ({
  env: { PUBLIC_SUPABASE_URL: 'https://test.supabase.co' },
}));

// Import AFTER mocks.
const { getCohortRoster, buildStudentEvidence } = await import('../src/lib/server/roster.js');

beforeEach(() => {
  for (const t of Object.keys(tableState)) {
    tableState[t] = { rows: [] };
  }
});

// --- Pure-transform tests -------------------------------------------------

describe('buildStudentEvidence', () => {
  it('sums passed-credit 1a courses and counts 1d advanced courses', () => {
    const ev = buildStudentEvidence({
      enrollments: [
        // 1a — Global I, Global II, US History, PIG → 4 credits passed
        { student_id: 'GN1', course_id: 1, credit_status: 'passed', catalog_credits: 1, catalog_counts_for: ['1a'] },
        { student_id: 'GN1', course_id: 2, credit_status: 'passed', catalog_credits: 1, catalog_counts_for: ['1a'] },
        { student_id: 'GN1', course_id: 3, credit_status: 'passed', catalog_credits: 1, catalog_counts_for: ['1a'] },
        { student_id: 'GN1', course_id: 4, credit_status: 'passed', catalog_credits: 1, catalog_counts_for: ['1a'] },
        // 1d — AP US Gov passed
        { student_id: 'GN1', course_id: 5, credit_status: 'passed', catalog_credits: 1, catalog_counts_for: ['1d'] },
        // unrelated math course (not counted)
        { student_id: 'GN1', course_id: 6, credit_status: 'passed', catalog_credits: 1, catalog_counts_for: [] },
        // failed 1a — should not contribute
        { student_id: 'GN1', course_id: 7, credit_status: 'failed', catalog_credits: 1, catalog_counts_for: ['1a'] },
      ],
      regents: [],
      awarded: [],
    });
    expect(ev.ssCreditsPassed).toBe(4);
    expect(ev.advancedSsCount).toBe(1);
  });

  it('translates pathway_type civic_elective_essay to PathwayId civic_elective', () => {
    const ev = buildStudentEvidence({
      enrollments: [],
      regents: [],
      awarded: [
        { student_id: 'GN1', pathway_type: 'civic_elective_essay', points_awarded: 0.5, awarded_at: null },
        { student_id: 'GN1', pathway_type: 'service_learning', points_awarded: 1, awarded_at: null },
      ],
    });
    expect(ev.awarded.map((a) => a.pathway).sort()).toEqual(['civic_elective', 'service_learning']);
  });
});

// --- End-to-end roster tests ----------------------------------------------

describe('getCohortRoster', () => {
  it('returns [] when there are no students in the cohort', async () => {
    const roster = await getCohortRoster();
    expect(roster).toEqual([]);
  });

  it('returns one eligible row when a student has hit 6 points across both columns', async () => {
    // Student with:
    //   - 1a: 4 SS credits → 1 pt knowledge
    //   - 1b: Regents Mastery (Global II=87) → 1.5 pt knowledge
    //   - 2f: HS Capstone awarded 4 pts → 4 pt participation
    //   Total: 2.5 K + 4 P = 6.5 → eligible.
    tableState.students.rows = [
      {
        id: 'GN20271234',
        last_name: 'Goldberg',
        first_name: 'Maya',
        grad_year: 2027,
        status: 'active',
        counselor_id: null,
      },
    ];
    tableState.course_enrollment.rows = [
      {
        student_id: 'GN20271234',
        course_id: 1,
        credit_status: 'passed',
        course_catalog: { credits: 1, counts_for: ['1a'] },
      },
      {
        student_id: 'GN20271234',
        course_id: 2,
        credit_status: 'passed',
        course_catalog: { credits: 1, counts_for: ['1a'] },
      },
      {
        student_id: 'GN20271234',
        course_id: 3,
        credit_status: 'passed',
        course_catalog: { credits: 1, counts_for: ['1a'] },
      },
      {
        student_id: 'GN20271234',
        course_id: 4,
        credit_status: 'passed',
        course_catalog: { credits: 1, counts_for: ['1a'] },
      },
    ];
    tableState.regents_scores.rows = [
      {
        student_id: 'GN20271234',
        exam_code: 'GLOBAL_II',
        score: 87,
        safety_net_applied: false,
      },
    ];
    tableState.pathway_submissions.rows = [
      {
        student_id: 'GN20271234',
        pathway_type: 'hs_capstone',
        status: 'awarded',
        points_awarded: 4,
        awarded_at: '2026-04-01T12:00:00Z',
      },
    ];

    const roster = await getCohortRoster();
    expect(roster).toHaveLength(1);
    const row = roster[0]!;
    expect(row.studentId).toBe('GN20271234');
    expect(row.knowledge).toBe(2.5);
    expect(row.participation).toBe(4);
    expect(row.total).toBe(6.5);
    expect(row.eligible).toBe(true);
    expect(row.status).toBe('eligible');
    expect(row.awardedAt).toBe('2026-04-01T12:00:00Z');
  });

  it('returns ineligible row with status=needs_knowledge when knowledge column is short', async () => {
    // Student with:
    //   - 1a: 0 (only 2 SS credits) → 0 knowledge from 1a
    //   - 2f: HS Capstone awarded 4 pts → 4 participation
    //   Total: 0 K + 4 P. Knowledge < 2 → not eligible, status=needs_knowledge.
    tableState.students.rows = [
      {
        id: 'GN20281111',
        last_name: 'Chen',
        first_name: 'David',
        grad_year: 2028,
        status: 'active',
        counselor_id: null,
      },
    ];
    tableState.course_enrollment.rows = [
      {
        student_id: 'GN20281111',
        course_id: 1,
        credit_status: 'passed',
        course_catalog: { credits: 1, counts_for: ['1a'] },
      },
      {
        student_id: 'GN20281111',
        course_id: 2,
        credit_status: 'passed',
        course_catalog: { credits: 1, counts_for: ['1a'] },
      },
    ];
    tableState.pathway_submissions.rows = [
      {
        student_id: 'GN20281111',
        pathway_type: 'hs_capstone',
        status: 'awarded',
        points_awarded: 4,
        awarded_at: '2026-05-01T00:00:00Z',
      },
    ];

    const roster = await getCohortRoster();
    expect(roster).toHaveLength(1);
    const row = roster[0]!;
    expect(row.knowledge).toBe(0);
    expect(row.participation).toBe(4);
    expect(row.eligible).toBe(false);
    expect(row.status).toBe('needs_knowledge');
  });

  it('marks student as awarded when student.status==="awarded"', async () => {
    tableState.students.rows = [
      {
        id: 'GN20251000',
        last_name: 'Park',
        first_name: 'Lina',
        grad_year: 2025,
        status: 'awarded',
        counselor_id: null,
      },
    ];
    const roster = await getCohortRoster();
    expect(roster[0]?.status).toBe('awarded');
  });

  it('runs computePoints + isEligible consistently with the rules package', () => {
    const ev = buildStudentEvidence({
      enrollments: [
        { student_id: 'GN1', course_id: 1, credit_status: 'passed', catalog_credits: 1, catalog_counts_for: ['1a'] },
        { student_id: 'GN1', course_id: 2, credit_status: 'passed', catalog_credits: 1, catalog_counts_for: ['1a'] },
        { student_id: 'GN1', course_id: 3, credit_status: 'passed', catalog_credits: 1, catalog_counts_for: ['1a'] },
        { student_id: 'GN1', course_id: 4, credit_status: 'passed', catalog_credits: 1, catalog_counts_for: ['1a'] },
      ],
      regents: [
        { student_id: 'GN1', exam_code: 'GLOBAL_II', score: 87, safety_net_applied: false },
        { student_id: 'GN1', exam_code: 'US_HISTORY', score: 91, safety_net_applied: false },
      ],
      awarded: [
        { student_id: 'GN1', pathway_type: 'service_learning', points_awarded: 1, awarded_at: null },
        { student_id: 'GN1', pathway_type: 'service_learning', points_awarded: 1, awarded_at: null },
      ],
    });
    const totals = computePoints(ev);
    // 1a (1) + Global II Mastery (1.5) + US History Mastery (1.5) = 4 K
    // service_learning × 2 = 2 P
    // Total 6 → eligible.
    expect(totals.knowledge).toBe(4);
    expect(totals.participation).toBe(2);
    expect(totals.total).toBe(6);
    expect(isEligible(totals)).toBe(true);
  });
});
