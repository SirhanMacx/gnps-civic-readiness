/**
 * Unit tests for the SCRC committee actions in src/lib/server/scrc.ts.
 *
 * Strategy: stub `supabaseAdmin()` with a recording fake so we can assert on
 * the queries built (filters, payloads), and the audit_log insertions, without
 * standing up a real Supabase project.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Recording stub for the Supabase client ------------------------------

interface FromCall {
  table: string;
  op: 'select' | 'update' | 'insert';
  payload?: any;
  filters: Array<{ kind: string; args: any[] }>;
  selectFields?: string;
  selectOpts?: any;
}

const calls: FromCall[] = [];

// Configurable canned responses keyed by table+op.
const cannedResponses: Map<string, { data: any; error: any; count?: number }> = new Map();

function setResponse(table: string, op: string, body: { data: any; error: any; count?: number }) {
  cannedResponses.set(`${table}|${op}`, body);
}
function getResponse(table: string, op: string) {
  return cannedResponses.get(`${table}|${op}`) ?? { data: null, error: null };
}

function makeQueryBuilder(call: FromCall) {
  const builder: any = {};

  // SELECT chain (handles eq/in/order/maybeSingle terminals + count).
  const selectChain = () => {
    const node: any = {};
    const addFilter = (kind: string) => (...args: any[]) => {
      call.filters.push({ kind, args });
      return node;
    };
    node.eq = addFilter('eq');
    node.in = addFilter('in');
    node.order = addFilter('order');
    node.maybeSingle = async () => getResponse(call.table, 'select');
    // Awaiting the chain itself returns the response.
    node.then = (resolve: any, reject?: any) =>
      Promise.resolve(getResponse(call.table, 'select')).then(resolve, reject);
    return node;
  };

  // UPDATE chain
  const updateChain = () => {
    const node: any = {};
    const addFilter = (kind: string) => (...args: any[]) => {
      call.filters.push({ kind, args });
      return node;
    };
    node.eq = addFilter('eq');
    node.then = (resolve: any, reject?: any) =>
      Promise.resolve(getResponse(call.table, 'update')).then(resolve, reject);
    return node;
  };

  builder.select = (fields?: string, opts?: any) => {
    call.op = 'select';
    call.selectFields = fields;
    call.selectOpts = opts;
    // For count: { exact: true, head: true }, terminal returns the response immediately.
    if (opts?.head && opts?.count === 'exact') {
      const node: any = {};
      const addFilter = (kind: string) => (...args: any[]) => {
        call.filters.push({ kind, args });
        return node;
      };
      node.eq = addFilter('eq');
      node.in = addFilter('in');
      node.then = (resolve: any, reject?: any) =>
        Promise.resolve(getResponse(call.table, 'select')).then(resolve, reject);
      return node;
    }
    return selectChain();
  };

  builder.update = (payload: any) => {
    call.op = 'update';
    call.payload = payload;
    return updateChain();
  };

  builder.insert = (payload: any) => {
    call.op = 'insert';
    call.payload = payload;
    // The insert may or may not chain a .select(); we model both.
    const node: any = {};
    node.select = () => ({
      single: async () => getResponse(call.table, 'insert')
    });
    node.then = (resolve: any, reject?: any) =>
      Promise.resolve(getResponse(call.table, 'insert')).then(resolve, reject);
    return node;
  };

  return builder;
}

const fakeAdmin = {
  from(table: string) {
    const call: FromCall = { table, op: 'select', filters: [] };
    calls.push(call);
    return makeQueryBuilder(call);
  }
};

vi.mock('$server/supabase.js', () => ({
  supabaseAdmin: () => fakeAdmin
}));

vi.mock('$env/dynamic/private', () => ({
  env: { SUPABASE_SERVICE_ROLE_KEY: 'srk-test' }
}));
vi.mock('$env/dynamic/public', () => ({
  env: { PUBLIC_SUPABASE_URL: 'https://test.supabase.co', PUBLIC_SUPABASE_ANON_KEY: 'anon-test' }
}));

const {
  approveTopic,
  rejectTopic,
  requestProposalRevisions,
  scoreCompletedProject,
  listProposalQueue,
  listScoringQueue,
  countAwardedProjects,
  computePointsAwarded,
  RUBRICS,
  SCRC_PATHWAY_TYPES
} = await import('../src/lib/server/scrc.js');

const REVIEWER_ID = '00000000-0000-0000-0000-000000000099';

beforeEach(() => {
  calls.length = 0;
  cannedResponses.clear();
});

// ---- listProposalQueue ----------------------------------------------------

describe('listProposalQueue', () => {
  it('filters to status=proposed and the four project pathway types', async () => {
    setResponse('pathway_submissions', 'select', {
      data: [
        {
          id: 1,
          student_id: 'GN20271234',
          pathway_type: 'hs_capstone',
          status: 'proposed',
          proposed_at: '2026-05-01T12:00:00Z',
          submitted_at: null,
          domain_tags: ['knowledge', 'experiences'],
          proposal_data: {
            issue_identified: 'Plastic recycling participation',
            scope: 'local',
            advisor_name: 'Ms Doe'
          },
          students: { first_name: 'Asha', last_name: 'Patel', grad_year: 2027 }
        }
      ],
      error: null
    });

    const rows = await listProposalQueue();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      submissionId: 1,
      studentFullName: 'Asha Patel',
      pathwayType: 'hs_capstone',
      status: 'proposed',
      scope: 'local',
      advisorName: 'Ms Doe'
    });

    // Verify the underlying query used the right filters.
    const psCall = calls.find((c) => c.table === 'pathway_submissions');
    expect(psCall).toBeTruthy();
    const eqStatus = psCall!.filters.find((f) => f.kind === 'eq' && f.args[0] === 'status');
    expect(eqStatus?.args[1]).toBe('proposed');
    const inPathway = psCall!.filters.find((f) => f.kind === 'in' && f.args[0] === 'pathway_type');
    // Verify all four project pathway types appear in the IN list.
    expect(inPathway?.args[1]).toEqual(expect.arrayContaining([...SCRC_PATHWAY_TYPES]));
    expect(inPathway?.args[1]).not.toContain('service_learning');
    expect(inPathway?.args[1]).not.toContain('civic_elective_essay');
  });
});

// ---- listScoringQueue -----------------------------------------------------

describe('listScoringQueue', () => {
  it('filters to status=submitted', async () => {
    setResponse('pathway_submissions', 'select', { data: [], error: null });
    await listScoringQueue();
    const psCall = calls.find((c) => c.table === 'pathway_submissions');
    const eqStatus = psCall!.filters.find((f) => f.kind === 'eq' && f.args[0] === 'status');
    expect(eqStatus?.args[1]).toBe('submitted');
  });
});

// ---- approveTopic ---------------------------------------------------------

describe('approveTopic', () => {
  it('transitions status proposed → topic_approved and writes audit row', async () => {
    setResponse('pathway_submissions', 'update', { data: null, error: null });
    setResponse('audit_log', 'insert', { data: null, error: null });

    await approveTopic({ submissionId: 42, reviewerId: REVIEWER_ID, notes: 'Looks great.' });

    const upd = calls.find((c) => c.table === 'pathway_submissions' && c.op === 'update');
    expect(upd).toBeTruthy();
    expect(upd!.payload).toMatchObject({
      status: 'topic_approved',
      topic_approved_by: REVIEWER_ID,
      notes: 'Looks great.'
    });
    expect(upd!.payload.topic_approved_at).toBeDefined();
    // Guard: must scope to id=42 AND require status=proposed (no overwriting other states).
    expect(upd!.filters).toEqual(
      expect.arrayContaining([
        { kind: 'eq', args: ['id', 42] },
        { kind: 'eq', args: ['status', 'proposed'] }
      ])
    );

    const audit = calls.find((c) => c.table === 'audit_log' && c.op === 'insert');
    expect(audit).toBeTruthy();
    expect(audit!.payload).toMatchObject({
      actor_id: REVIEWER_ID,
      actor_kind: 'scrc_member',
      action: 'scrc_approved_topic',
      target_type: 'pathway_submissions',
      target_id: '42',
      data: { notes: 'Looks great.' }
    });
  });

  it('omits notes column when none supplied', async () => {
    setResponse('pathway_submissions', 'update', { data: null, error: null });
    setResponse('audit_log', 'insert', { data: null, error: null });

    await approveTopic({ submissionId: 7, reviewerId: REVIEWER_ID });

    const upd = calls.find((c) => c.table === 'pathway_submissions' && c.op === 'update');
    expect(upd!.payload.notes).toBeUndefined();
  });
});

// ---- rejectTopic ----------------------------------------------------------

describe('rejectTopic', () => {
  it('stores reason and writes audit row with action=scrc_rejected_topic', async () => {
    setResponse('pathway_submissions', 'update', { data: null, error: null });
    setResponse('audit_log', 'insert', { data: null, error: null });

    await rejectTopic({
      submissionId: 99,
      reviewerId: REVIEWER_ID,
      reason: 'Topic too narrow — please expand scope.'
    });

    const upd = calls.find((c) => c.table === 'pathway_submissions' && c.op === 'update');
    expect(upd!.payload).toMatchObject({
      status: 'rejected',
      notes: 'Topic too narrow — please expand scope.'
    });

    const audit = calls.find((c) => c.table === 'audit_log' && c.op === 'insert');
    expect(audit!.payload).toMatchObject({
      action: 'scrc_rejected_topic',
      target_id: '99',
      data: { reason: 'Topic too narrow — please expand scope.' }
    });
  });

  it('rejects too-short reasons via Zod', async () => {
    await expect(
      rejectTopic({ submissionId: 1, reviewerId: REVIEWER_ID, reason: 'no' })
    ).rejects.toThrow();
  });
});

// ---- requestProposalRevisions --------------------------------------------

describe('requestProposalRevisions', () => {
  it('updates notes but leaves status as proposed and writes audit row', async () => {
    setResponse('pathway_submissions', 'update', { data: null, error: null });
    setResponse('audit_log', 'insert', { data: null, error: null });

    await requestProposalRevisions({
      submissionId: 11,
      reviewerId: REVIEWER_ID,
      notes: 'Please tighten your civic-experience plan.'
    });

    const upd = calls.find((c) => c.table === 'pathway_submissions' && c.op === 'update');
    // No `status` key on update — stays proposed.
    expect(upd!.payload.status).toBeUndefined();
    expect(upd!.payload.notes).toBe('Please tighten your civic-experience plan.');

    const audit = calls.find((c) => c.table === 'audit_log' && c.op === 'insert');
    expect(audit!.payload.action).toBe('scrc_requested_topic_revisions');
  });
});

// ---- scoreCompletedProject ------------------------------------------------

describe('scoreCompletedProject', () => {
  it('sets rubric_scores, computes points_awarded for a perfect capstone (4/4 = 4 pts)', async () => {
    setResponse('pathway_submissions', 'update', { data: null, error: null });
    setResponse('audit_log', 'insert', { data: null, error: null });

    const allFour: Record<string, number> = {};
    for (const c of RUBRICS.hs_capstone.criteria) allFour[c.key] = 4;

    const { pointsAwarded } = await scoreCompletedProject({
      submissionId: 5,
      reviewerId: REVIEWER_ID,
      pathway: 'hs_capstone',
      rubricScores: allFour,
      notes: 'Outstanding work.'
    });

    expect(pointsAwarded).toBe(4);

    const upd = calls.find((c) => c.table === 'pathway_submissions' && c.op === 'update');
    expect(upd!.payload).toMatchObject({
      status: 'scored',
      rubric_scores: allFour,
      points_awarded: 4,
      scored_by: REVIEWER_ID,
      notes: 'Outstanding work.'
    });
    expect(upd!.payload.scored_at).toBeDefined();
    expect(upd!.filters).toEqual(
      expect.arrayContaining([
        { kind: 'eq', args: ['id', 5] },
        { kind: 'eq', args: ['status', 'submitted'] }
      ])
    );

    const audit = calls.find((c) => c.table === 'audit_log' && c.op === 'insert');
    expect(audit!.payload).toMatchObject({
      action: 'scrc_scored_project',
      target_id: '5',
      data: {
        pathway: 'hs_capstone',
        rubric_scores: allFour,
        points_awarded: 4
      }
    });
  });

  it('throws when a criterion is missing from the rubric scores', async () => {
    await expect(
      scoreCompletedProject({
        submissionId: 5,
        reviewerId: REVIEWER_ID,
        pathway: 'hs_capstone',
        rubricScores: { identify_issue: 4 } // missing 3 criteria
      })
    ).rejects.toThrow(/missing criteria/);
  });

  it('rejects out-of-range scores via Zod (5 > 4)', async () => {
    await expect(
      scoreCompletedProject({
        submissionId: 5,
        reviewerId: REVIEWER_ID,
        pathway: 'hs_capstone',
        rubricScores: { identify_issue: 5 } as Record<string, number>
      })
    ).rejects.toThrow();
  });
});

// ---- computePointsAwarded -------------------------------------------------

describe('computePointsAwarded', () => {
  it('full marks → pathway max points, every pathway', () => {
    for (const pathway of SCRC_PATHWAY_TYPES) {
      const rubric = RUBRICS[pathway];
      const all4: Record<string, number> = {};
      for (const c of rubric.criteria) all4[c.key] = 4;
      expect(computePointsAwarded(pathway, all4)).toBe(rubric.maxPoints);
    }
  });

  it('half marks → ~half the pathway max (rounded to 0.5)', () => {
    // hs_capstone: 4 criteria × 2 / 4 = 0.5 ratio → 4 * 0.5 = 2.0
    const half: Record<string, number> = {};
    for (const c of RUBRICS.hs_capstone.criteria) half[c.key] = 2;
    expect(computePointsAwarded('hs_capstone', half)).toBe(2);
  });

  it('hs_civic_project all 4s → 1.5 pts', () => {
    const all4: Record<string, number> = {};
    for (const c of RUBRICS.hs_civic_project.criteria) all4[c.key] = 4;
    expect(computePointsAwarded('hs_civic_project', all4)).toBe(1.5);
  });

  it('rounds to nearest 0.5 (capstone 3/4 across the board → 3.0 pts)', () => {
    // 4 × 3 / 16 = 0.75 ratio → 4 * 0.75 = 3.0
    const threes: Record<string, number> = {};
    for (const c of RUBRICS.hs_capstone.criteria) threes[c.key] = 3;
    expect(computePointsAwarded('hs_capstone', threes)).toBe(3);
  });
});

// ---- countAwardedProjects -------------------------------------------------

describe('countAwardedProjects', () => {
  it('returns the head-count from Supabase', async () => {
    setResponse('pathway_submissions', 'select', { data: null, error: null, count: 17 });
    const n = await countAwardedProjects();
    expect(n).toBe(17);
    const psCall = calls.find((c) => c.table === 'pathway_submissions');
    expect(psCall!.selectOpts).toMatchObject({ count: 'exact', head: true });
  });
});
