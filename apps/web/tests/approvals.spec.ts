import { beforeEach, describe, expect, it, vi } from 'vitest';

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

interface Table {
  rows: Record<string, unknown>[];
  updates: Record<string, unknown>[];
  inserts: Record<string, unknown>[][];
}

const tables: Record<string, Table> = {};
function reset(): void {
  for (const k of Object.keys(tables)) delete tables[k];
}
function ensure(name: string): Table {
  if (!tables[name]) tables[name] = { rows: [], updates: [], inserts: [] };
  return tables[name]!;
}

function buildQuery(tableName: string) {
  const t = ensure(tableName);
  const filters: Array<{ col: string; val: unknown }> = [];

  const applyFilters = () =>
    t.rows.filter((row) => filters.every((f) => row[f.col] === f.val));

  const q: any = {
    select() {
      return q;
    },
    eq(col: string, val: unknown) {
      filters.push({ col, val });
      return q;
    },
    maybeSingle: async () => ({ data: applyFilters()[0] ?? null, error: null }),
    update(changes: Record<string, unknown>) {
      t.updates.push(changes);
      const ret: any = {
        eq(col: string, val: unknown) {
          filters.push({ col, val });
          for (const row of applyFilters()) {
            Object.assign(row, changes);
          }
          return Promise.resolve({ error: null });
        }
      };
      return ret;
    },
    insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      const arr = Array.isArray(rows) ? rows : [rows];
      t.inserts.push(arr);
      t.rows.push(...arr);
      return Promise.resolve({ data: arr, error: null });
    },
    then(onFulfilled: any) {
      return Promise.resolve({ data: applyFilters(), error: null }).then(onFulfilled);
    }
  };
  return q;
}

vi.mock('$server/supabase.js', () => ({
  supabaseAdmin: () => ({
    from: (name: string) => buildQuery(name)
  })
}));

const { approveSubmission } = await import('../src/lib/server/approvals.js');

describe('approveSubmission', () => {
  beforeEach(() => reset());

  it('blocks service-learning awards before the 25-hour threshold is met', async () => {
    ensure('pathway_submissions').rows.push({
      id: 1,
      student_id: 'GN1',
      status: 'submitted',
      pathway_type: 'service_learning'
    });
    ensure('hours_log').rows.push({
      submission_id: 1,
      hours: 10,
      confirmation_status: 'confirmed'
    });

    await expect(
      approveSubmission({ submissionId: 1, approverId: 'counselor-1', points: 1 })
    ).rejects.toThrow(/25 confirmed hours/);
    expect(ensure('pathway_submissions').updates).toHaveLength(0);
  });

  it('blocks hours-based awards until every hour row is supervisor-confirmed', async () => {
    ensure('pathway_submissions').rows.push({
      id: 2,
      student_id: 'GN1',
      status: 'submitted',
      pathway_type: 'wbl_extracurr'
    });
    ensure('hours_log').rows.push({
      submission_id: 2,
      hours: 40,
      confirmation_status: 'pending'
    });

    await expect(
      approveSubmission({ submissionId: 2, approverId: 'counselor-1', points: 0.5 })
    ).rejects.toThrow(/supervisor-confirmed/);
    expect(ensure('pathway_submissions').updates).toHaveLength(0);
  });

  it('awards a confirmed threshold-met service-learning submission', async () => {
    ensure('pathway_submissions').rows.push({
      id: 3,
      student_id: 'GN1',
      status: 'submitted',
      pathway_type: 'service_learning'
    });
    ensure('hours_log').rows.push({
      submission_id: 3,
      hours: 25,
      confirmation_status: 'confirmed'
    });

    await approveSubmission({ submissionId: 3, approverId: 'counselor-1', points: 1 });
    expect(ensure('pathway_submissions').updates[0]).toMatchObject({
      status: 'awarded',
      points_awarded: 1
    });
    expect(ensure('audit_log').inserts[0]?.[0]).toMatchObject({
      actor_id: 'counselor-1',
      action: 'counselor_approved_submission'
    });
  });
});
