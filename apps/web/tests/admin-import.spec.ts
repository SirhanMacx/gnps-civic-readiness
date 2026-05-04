/**
 * Unit tests for the IC CSV importer at src/lib/server/imports.ts.
 *
 * parseIcCsv is pure logic — no DB. previewImport + commitImport read/write
 * Supabase, so we mock supabaseAdmin to a configurable in-memory shim. The
 * shim records every from(...).upsert/insert/select call so we can assert
 * the right rows hit the right tables.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock $env modules so anything pulled in doesn't try to read real env vars.
vi.mock('$env/dynamic/private', () => ({
  env: { SUPABASE_SERVICE_ROLE_KEY: 'srk-test', SUPABASE_ANON_KEY: 'anon-test' }
}));
vi.mock('$env/dynamic/public', () => ({
  env: {
    PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    PUBLIC_SUPABASE_ANON_KEY: 'anon-test',
    PUBLIC_APP_URL: 'http://localhost:5173'
  }
}));

// ---------- in-memory Supabase shim ---------------------------------------

interface ShimTable {
  rows: Record<string, unknown>[];
  /** Upserts in the order they happened (for assertion). */
  upserts: Record<string, unknown>[][];
  /** Inserts in the order they happened. */
  inserts: Record<string, unknown>[][];
}

const tables: Record<string, ShimTable> = {};
function reset(): void {
  for (const k of Object.keys(tables)) {
    delete tables[k];
  }
}
function ensure(name: string): ShimTable {
  if (!tables[name]) tables[name] = { rows: [], upserts: [], inserts: [] };
  return tables[name]!;
}

function buildQuery(tableName: string) {
  const t = ensure(tableName);
  let filterCol: string | null = null;
  let filterVals: unknown[] = [];
  let isInFilter = false;

  const queryObj: any = {
    select(_cols: string) {
      return queryObj;
    },
    in(col: string, vals: unknown[]) {
      filterCol = col;
      filterVals = vals;
      isInFilter = true;
      return queryObj;
    },
    eq(col: string, val: unknown) {
      filterCol = col;
      filterVals = [val];
      isInFilter = true;
      return queryObj;
    },
    ilike(col: string, val: string) {
      filterCol = col;
      filterVals = [val];
      isInFilter = true;
      return queryObj;
    },
    order() {
      return queryObj;
    },
    limit() {
      return queryObj;
    },
    upsert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      const arr = Array.isArray(rows) ? rows : [rows];
      t.upserts.push(arr);
      // Mirror into in-memory rows so subsequent select sees them.
      for (const row of arr) t.rows.push(row);
      const ret: any = {
        select() {
          return ret;
        },
        single: async () => ({ data: arr[0], error: null }),
        then(onFulfilled: any) {
          // When awaited as `.upsert(...).select(...)` without `.single()`,
          // resolve to { data, error } shape.
          return Promise.resolve({ data: arr, error: null }).then(onFulfilled);
        }
      };
      return ret;
    },
    insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      const arr = Array.isArray(rows) ? rows : [rows];
      t.inserts.push(arr);
      for (const row of arr) t.rows.push(row);
      const ret: any = {
        select() {
          return ret;
        },
        single: async () => ({ data: { ...arr[0], id: t.rows.length }, error: null }),
        then(onFulfilled: any) {
          return Promise.resolve({ data: arr, error: null }).then(onFulfilled);
        }
      };
      return ret;
    },
    update(_changes: Record<string, unknown>) {
      const ret: any = {
        eq() {
          return ret;
        },
        select() {
          return ret;
        },
        single: async () => ({ data: null, error: null })
      };
      return ret;
    },
    delete() {
      const ret: any = {
        eq: async () => ({ error: null })
      };
      return ret;
    },
    maybeSingle: async () => {
      // Find one row matching filterCol/filterVals.
      if (!isInFilter || filterCol === null) {
        return { data: null, error: null };
      }
      const found = t.rows.find((r) => filterVals.includes(r[filterCol!]));
      return { data: found ?? null, error: null };
    },
    then(onFulfilled: any) {
      // For shapes like `.from(t).select(...)` (no filter) → return all rows.
      // Or `.from(t).select(...).in(col,vals)` → filtered rows.
      const filtered = isInFilter
        ? t.rows.filter((r) => filterVals.includes(r[filterCol!]))
        : t.rows.slice();
      return Promise.resolve({ data: filtered, error: null }).then(onFulfilled);
    }
  };
  return queryObj;
}

vi.mock('$server/supabase.js', () => ({
  supabaseAdmin: () => ({
    from: (name: string) => buildQuery(name),
    storage: {
      from: () => ({
        download: async () => ({ data: null, error: { message: 'not used in tests' } })
      })
    }
  })
}));

// Import under test AFTER mocks are in place.
const {
  parseIcCsv,
  previewImport,
  commitImport
} = await import('../src/lib/server/imports.js');

// ---------- parseIcCsv ----------------------------------------------------

describe('parseIcCsv', () => {
  beforeEach(() => reset());

  it('accepts valid 5-column rows (one of each kind)', () => {
    const csv = [
      'student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit',
      'GN20271234,Goldberg,Maya,2027,course,SS_GLOBAL_II,2024-2025,passed',
      'GN20271234,Goldberg,Maya,2027,regents,GLOBAL_II,2025-06-15,87',
      'GN20271234,Goldberg,Maya,2027,demographic,,,'
    ].join('\n');
    const { rows, errors } = parseIcCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ kind: 'course', code: 'SS_GLOBAL_II', scoreOrCredit: 'passed' });
    expect(rows[1]).toMatchObject({ kind: 'regents', code: 'GLOBAL_II', scoreOrCredit: '87' });
    expect(rows[2]).toMatchObject({ kind: 'demographic' });
  });

  it('rejects malformed dates on regents rows', () => {
    const csv = [
      'student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit',
      // Year/month/day garbled
      'GN1,Smith,A,2027,regents,GLOBAL_II,2025-13-40,75',
      // Right shape but impossible day (Feb 30)
      'GN2,Smith,B,2027,regents,US_HISTORY,2025-02-30,80'
    ].join('\n');
    const { rows, errors } = parseIcCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(2);
    expect(errors[0].reason).toMatch(/year_or_date/);
    expect(errors[1].reason).toMatch(/year_or_date/);
  });

  it('rejects unknown kind', () => {
    const csv = [
      'student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit',
      'GN1,Smith,A,2027,bogus,X,2024-2025,passed'
    ].join('\n');
    const { rows, errors } = parseIcCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/unknown kind/);
  });

  it('rejects out-of-range Regents scores and bad credit values', () => {
    const csv = [
      'student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit',
      'GN1,Smith,A,2027,regents,GLOBAL_II,2025-06-15,150',
      'GN2,Smith,B,2027,course,SS_X,2024-2025,maybe'
    ].join('\n');
    const { rows, errors } = parseIcCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors[0].reason).toMatch(/regents score_or_credit/);
    expect(errors[1].reason).toMatch(/course score_or_credit/);
  });

  it('reports a missing-header error and parses zero rows', () => {
    const csv = ['student_id,last_name,first_name', 'GN1,Smith,A'].join('\n');
    const { rows, errors } = parseIcCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].reason).toMatch(/missing required header/);
  });
});

// ---------- previewImport -------------------------------------------------

describe('previewImport', () => {
  beforeEach(() => reset());

  it('returns newCount = N for fresh data with no existing rows', async () => {
    const csv = [
      'student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit',
      'GN1,Smith,A,2027,course,SS_GLOBAL_II,2024-2025,passed',
      'GN1,Smith,A,2027,regents,GLOBAL_II,2025-06-15,87',
      'GN2,Jones,B,2027,demographic,,,',
      'GN3,Lee,C,2027,course,SS_X,2024-2025,passed'
    ].join('\n');
    const { rows, errors } = parseIcCsv(csv);
    expect(errors).toHaveLength(0);
    const preview = await previewImport(rows);
    expect(preview.newCount).toBe(rows.length);
    expect(preview.updatedCount).toBe(0);
    expect(preview.unchangedCount).toBe(0);
    expect(preview.byKind.course).toBe(2);
    expect(preview.byKind.regents).toBe(1);
    expect(preview.byKind.demographic).toBe(1);
  });

  it('flags an unchanged row when the existing record matches', async () => {
    // Pre-seed a student row so the demographic row would be "unchanged".
    ensure('students').rows.push({
      id: 'GN1',
      last_name: 'Smith',
      first_name: 'A',
      grad_year: 2027
    });
    const csv = [
      'student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit',
      'GN1,Smith,A,2027,demographic,,,'
    ].join('\n');
    const { rows } = parseIcCsv(csv);
    const preview = await previewImport(rows);
    expect(preview.unchangedCount).toBe(1);
    expect(preview.newCount).toBe(0);
  });
});

// ---------- commitImport --------------------------------------------------

describe('commitImport', () => {
  beforeEach(() => reset());

  it('upserts students + course_enrollment + regents_scores and writes audit_log', async () => {
    // Pre-seed catalog so the course matches.
    ensure('course_catalog').rows.push({ id: 42, course_code: 'SS_GLOBAL_II' });

    const csv = [
      'student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit',
      'GN20271234,Goldberg,Maya,2027,course,SS_GLOBAL_II,2024-2025,passed',
      'GN20271234,Goldberg,Maya,2027,regents,GLOBAL_II,2025-06-15,87'
    ].join('\n');
    const { rows, errors } = parseIcCsv(csv);
    expect(errors).toHaveLength(0);

    const result = await commitImport(rows, 'admin-uuid');
    expect(result.imported.students.upserted).toBe(1);
    expect(result.imported.courseEnrollment.upserted).toBe(1);
    expect(result.imported.regentsScores.upserted).toBe(1);
    expect(result.imported.courseEnrollment.missingCourse).toBe(0);

    // Students upsert payload.
    const studentUps = ensure('students').upserts;
    expect(studentUps).toHaveLength(1);
    expect(studentUps[0]?.[0]).toMatchObject({
      id: 'GN20271234',
      last_name: 'Goldberg',
      first_name: 'Maya',
      grad_year: 2027
    });

    // Enrollment upsert payload includes the resolved course_id.
    const enrUps = ensure('course_enrollment').upserts;
    expect(enrUps[0]?.[0]).toMatchObject({
      student_id: 'GN20271234',
      course_id: 42,
      school_year: '2024-2025',
      credit_status: 'passed'
    });

    // Audit log row.
    const auditIns = ensure('audit_log').inserts;
    expect(auditIns).toHaveLength(1);
    expect(auditIns[0]?.[0]).toMatchObject({
      action: 'admin_imported_csv',
      actor_id: 'admin-uuid',
      target_type: 'import_session'
    });
    expect((auditIns[0]?.[0]?.data as any).rows).toBe(2);
  });

  it('reports missingCourse for course rows whose code is not in the catalog', async () => {
    // No catalog rows seeded.
    const csv = [
      'student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit',
      'GN1,Smith,A,2027,course,UNKNOWN_COURSE,2024-2025,passed'
    ].join('\n');
    const { rows } = parseIcCsv(csv);
    const result = await commitImport(rows, 'admin-uuid');
    expect(result.imported.courseEnrollment.upserted).toBe(0);
    expect(result.imported.courseEnrollment.missingCourse).toBe(1);
    expect(result.warnings.some((w) => w.includes('UNKNOWN_COURSE'))).toBe(true);
  });
});

afterEach(() => reset());
