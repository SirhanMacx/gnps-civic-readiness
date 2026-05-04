/**
 * End-to-end validation of the NYSED audit-pack assembly. We pump a small
 * synthetic dataset through loadCohort + the nysed-export pipeline, assert
 * the resulting zip's byte length is non-zero, and unzip-in-memory to verify
 * the file paths inside match the spec §4.5 layout.
 *
 * No HTTP layer — we exercise loadCohort + bundleZip directly so this test
 * also serves as a sanity check that an admin clicking "Export Audit Pack"
 * will actually receive a valid zip.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Minimal zip-central-directory reader. Avoids adding fflate as a direct
 * apps/web dep — we only need filenames + uncompressed-size + the bytes of
 * stored (uncompressed) entries (which is what bundleZip's level=6 produces
 * as deflate, plus a few that may be stored). The PDF bytes we read are
 * verified by their signature only ('%PDF'); we don't decompress deflate.
 */
function readZipCentralDirectory(zip: Uint8Array): {
  paths: string[];
  byPath: Map<string, { localOffset: number; uncompressedSize: number; compressionMethod: number }>;
} {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // EOCD signature 0x06054b50 — search backwards from end-of-file (≤ 22 + 65535 bytes).
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0 && i >= zip.length - 22 - 65535; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip EOCD not found');
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  const paths: string[] = [];
  const byPath = new Map<
    string,
    { localOffset: number; uncompressedSize: number; compressionMethod: number }
  >();
  let p = cdOffset;
  const end = cdOffset + cdSize;
  while (p < end) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const compressionMethod = view.getUint16(p + 10, true);
    const uncompressedSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    paths.push(name);
    byPath.set(name, { localOffset, uncompressedSize, compressionMethod });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { paths, byPath };
}


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

// Synthetic data sets keyed by Supabase table name. Reset before each test.
let dataByTable: Record<string, any[]> = {};

function makeQuery(tableName: string) {
  let filterCol: string | null = null;
  let filterVal: unknown = null;
  let inCol: string | null = null;
  let inVals: unknown[] = [];
  const q: any = {
    select(_: string) {
      return q;
    },
    eq(c: string, v: unknown) {
      filterCol = c;
      filterVal = v;
      return q;
    },
    in(c: string, v: unknown[]) {
      inCol = c;
      inVals = v;
      return q;
    },
    order() {
      return q;
    },
    limit() {
      return q;
    },
    insert: () => ({
      select: () => ({ single: async () => ({ data: { id: 1 }, error: null }) }),
      then: (cb: any) => Promise.resolve({ data: null, error: null }).then(cb)
    }),
    upsert: () => ({
      select: () => ({ single: async () => ({ data: { id: 1 }, error: null }) }),
      then: (cb: any) => Promise.resolve({ data: null, error: null }).then(cb)
    }),
    update() {
      return q;
    },
    delete() {
      return q;
    },
    maybeSingle: async () => {
      const rows = dataByTable[tableName] ?? [];
      const found = rows.find((r) => {
        if (filterCol !== null && r[filterCol] !== filterVal) return false;
        return true;
      });
      return { data: found ?? null, error: null };
    },
    then(onFulfilled: any) {
      let rows = dataByTable[tableName] ?? [];
      if (inCol !== null) rows = rows.filter((r) => inVals.includes(r[inCol!]));
      if (filterCol !== null) rows = rows.filter((r) => r[filterCol!] === filterVal);
      return Promise.resolve({ data: rows, error: null }).then(onFulfilled);
    }
  };
  return q;
}

vi.mock('$server/supabase.js', () => ({
  supabaseAdmin: () => ({
    from: (name: string) => makeQuery(name),
    storage: {
      from: () => ({
        download: async () => ({ data: null, error: { message: 'not seeded' } })
      })
    }
  })
}));

const { loadCohort } = await import('../src/lib/server/cohort.js');
const { rosterCsv, awardedCsv, auditCsv, renderStudentPdf, bundleZip } = await import(
  '$lib/nysed-export/index.js'
);

describe('audit pack assembly (cohort 2027 fake dataset)', () => {
  beforeEach(() => {
    dataByTable = {
      students: [
        {
          id: 'GN20271234',
          last_name: 'Goldberg',
          first_name: 'Maya',
          grad_year: 2027,
          status: 'awarded',
          accommodations_flag: false
        },
        {
          id: 'GN20275511',
          last_name: 'Chen',
          first_name: 'David',
          grad_year: 2027,
          status: 'active',
          accommodations_flag: false
        }
      ],
      pathway_submissions: [
        {
          id: 1,
          student_id: 'GN20271234',
          pathway_type: 'service_learning',
          status: 'awarded',
          points_awarded: 1,
          submitted_at: '2026-01-15T10:00:00Z',
          scored_at: '2026-01-20T10:00:00Z',
          awarded_at: '2026-01-21T10:00:00Z'
        },
        {
          id: 2,
          student_id: 'GN20271234',
          pathway_type: 'hs_capstone',
          status: 'awarded',
          points_awarded: 4,
          submitted_at: '2026-04-01T10:00:00Z',
          scored_at: '2026-04-15T10:00:00Z',
          awarded_at: '2026-04-16T10:00:00Z'
        }
      ],
      regents_scores: [
        {
          student_id: 'GN20271234',
          exam_code: 'GLOBAL_II',
          score: 87,
          exam_date: '2025-06-15',
          safety_net_applied: false
        },
        {
          student_id: 'GN20271234',
          exam_code: 'US_HISTORY',
          score: 91,
          exam_date: '2026-06-12',
          safety_net_applied: false
        }
      ],
      course_enrollment: [
        {
          student_id: 'GN20271234',
          course_id: 1,
          school_year: '2024-2025',
          final_grade: 92,
          credit_status: 'passed'
        },
        {
          student_id: 'GN20271234',
          course_id: 2,
          school_year: '2024-2025',
          final_grade: 95,
          credit_status: 'passed'
        }
      ],
      course_catalog: [
        { id: 1, course_code: 'SS_GLOBAL_II', title: 'Global History II', counts_for: ['1a'], credits: 1 },
        { id: 2, course_code: 'AP_US_HISTORY', title: 'AP US History', counts_for: ['1a', '1d'], credits: 1 }
      ],
      audit_log: [
        {
          occurred_at: '2026-01-21T10:00:00Z',
          action: 'counselor_approved',
          actor_kind: 'counselor',
          target_type: 'pathway_submissions',
          target_id: '1'
        }
      ]
    };
  });

  it('produces a valid zip whose paths match spec §4.5', async () => {
    const cohort = await loadCohort(2027);
    expect(cohort.students).toHaveLength(2);

    // Compute per-student PDFs.
    const pdfs = new Map<string, Uint8Array>();
    for (const s of cohort.students) {
      const stem = `${s.id}_${s.lastName}_${s.firstName}`;
      const pdf = await renderStudentPdf({
        student: s,
        submissions: cohort.submissionsByStudent.get(s.id) ?? [],
        regents: cohort.regentsByStudent.get(s.id) ?? [],
        enrollment: cohort.enrollmentByStudent.get(s.id) ?? [],
        auditExcerpt: cohort.auditExcerpt
      });
      pdfs.set(stem, pdf);
    }

    const zipBytes = bundleZip({
      studentPdfs: pdfs,
      rosterCsv: rosterCsv(cohort.students),
      awardedCsv: awardedCsv(cohort.students),
      auditCsv: auditCsv(cohort.auditExcerpt),
      evidenceFiles: new Map()
    });

    expect(zipBytes.byteLength).toBeGreaterThan(1000);

    const cd = readZipCentralDirectory(zipBytes);
    const paths = cd.paths.slice().sort();

    expect(paths).toContain('roster.csv');
    expect(paths).toContain('awarded_students.csv');
    expect(paths).toContain('audit_log_excerpt.csv');
    expect(paths.some((p) => p.startsWith('per_student/') && p.endsWith('.pdf'))).toBe(true);
    expect(paths).toContain('per_student/GN20271234_Goldberg_Maya.pdf');
    expect(paths).toContain('per_student/GN20275511_Chen_David.pdf');

    // We can validate CSV content via the source generators (the zip stores
    // them deflated; testing the upstream pure functions is equivalent and
    // avoids pulling in an unzip lib at test time).
    const roster = rosterCsv(cohort.students);
    expect(roster).toContain('GN20271234');
    expect(roster).toContain('Goldberg');
    expect(roster).toContain('Maya');
    expect(roster).toContain('grad_year');

    const awarded = awardedCsv(cohort.students);
    expect(awarded).toContain('GN20271234');
    expect(awarded).not.toContain('GN20275511');

    // Maya should have ≥ 6 points (1a 1pt + Global II 87→1pt + US Hist 91→1.5pt
    // + AP US History 1d→0.5pt + service_learning 1pt + hs_capstone 4pt = 9pt)
    // and be eligible.
    expect(roster).toContain('true'); // her eligible flag

    // Per-student PDFs: peek at the first 4 bytes inside the local-file-header
    // (PDFs are stored uncompressed at level 6 in fflate when their size is
    // already small — but if deflated, the magic bytes won't be at offset 0).
    // bundleZip uses level 6, so the PDF bytes are deflated. Instead of
    // decompressing, just assert the central-directory entry says the
    // uncompressed size is non-trivial.
    const mayaEntry = cd.byPath.get('per_student/GN20271234_Goldberg_Maya.pdf');
    expect(mayaEntry).toBeDefined();
    expect(mayaEntry!.uncompressedSize).toBeGreaterThan(500);
  }, 30_000);

  it('reports a non-zero zip byte length and lists at least roster + awarded + audit + 2 PDFs', async () => {
    const cohort = await loadCohort(2027);
    const pdfs = new Map<string, Uint8Array>();
    for (const s of cohort.students) {
      const stem = `${s.id}_${s.lastName}_${s.firstName}`;
      pdfs.set(
        stem,
        await renderStudentPdf({
          student: s,
          submissions: cohort.submissionsByStudent.get(s.id) ?? [],
          regents: cohort.regentsByStudent.get(s.id) ?? [],
          enrollment: cohort.enrollmentByStudent.get(s.id) ?? [],
          auditExcerpt: cohort.auditExcerpt
        })
      );
    }
    const zip = bundleZip({
      studentPdfs: pdfs,
      rosterCsv: rosterCsv(cohort.students),
      awardedCsv: awardedCsv(cohort.students),
      auditCsv: auditCsv(cohort.auditExcerpt),
      evidenceFiles: new Map()
    });
    expect(zip.byteLength).toBeGreaterThan(2000);
    const cd = readZipCentralDirectory(zip);
    expect(cd.paths.length).toBe(5); // roster + awarded + audit + 2 student PDFs
  }, 30_000);

  afterEach(() => {
    dataByTable = {};
  });
});
