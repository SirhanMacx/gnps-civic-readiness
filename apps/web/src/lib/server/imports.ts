/**
 * Infinite Campus CSV importer (Phase 1).
 *
 * Spec §4.4: a single counselor/admin-uploaded CSV with one row per
 * (student, course-or-exam) pair. Five row "kinds" are recognized:
 *
 *   - course:      course_enrollment row keyed by course code + school year
 *   - regents:     regents_scores row keyed by exam code + exam date
 *   - demographic: students-table fields only (no enrollment/score row)
 *
 * The flow is three-stage:
 *
 *   1. parseIcCsv(text)       — pure parse + per-row validation, no DB
 *   2. previewImport(rows)    — read-only diff against the live DB
 *   3. commitImport(rows, id) — actually upsert + write a single audit_log row
 *
 * Row 1 of the CSV is the header. Header order is enforced (spec §4.4 names
 * them in a specific order); we accept any column order as long as every
 * required header is present, and ignore unknown columns.
 *
 * Date / school-year shape:
 *   - course:  year_or_date must be `YYYY-YYYY` (e.g. "2024-2025")
 *   - regents: year_or_date must be `YYYY-MM-DD`
 *   - score_or_credit:
 *       * course      → "passed" | "failed" | "in_progress"
 *       * regents     → integer 0–100
 *       * demographic → ignored (left blank; we only read student-name fields)
 *   - safety_net_applied (optional):
 *       * regents     → true if IC marks a safety-net pass, special appeal,
 *                       or 45-variance case that NYSED says earns 1 point
 *       * course/demo → ignored
 */

import Papa from 'papaparse';
import { supabaseAdmin } from './supabase.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RowKind = 'course' | 'regents' | 'demographic';

export interface ParsedRow {
  rowNumber: number;
  studentId: string;
  lastName: string;
  firstName: string;
  gradYear: number;
  kind: RowKind;
  /** Course code (matched against course_catalog) OR Regents exam code. Empty for demographic. */
  code: string;
  /** "YYYY-YYYY" for courses; "YYYY-MM-DD" for regents; ignored for demographic. */
  yearOrDate: string;
  /** Free-form: passed|failed|in_progress|<int 0-100>|<empty>. */
  scoreOrCredit: string;
  /** Regents-only flag for safety-net / special-appeal / 45-variance credit. */
  safetyNetApplied: boolean;
}

export interface ImportError {
  row: number;
  reason: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ImportError[];
}

export interface PreviewResult {
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  byKind: { course: number; regents: number; demographic: number };
}

export interface CommitResult {
  imported: {
    students: { upserted: number };
    courseEnrollment: { upserted: number; missingCourse: number };
    regentsScores: { upserted: number };
  };
  auditLogId: number | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const REQUIRED_HEADERS = [
  'student_id',
  'last_name',
  'first_name',
  'grad_year',
  'kind',
  'code',
  'year_or_date',
  'score_or_credit'
] as const;

const VALID_KINDS = new Set<RowKind>(['course', 'regents', 'demographic']);
const VALID_CREDIT = new Set(['passed', 'failed', 'in_progress']);
const SCHOOL_YEAR_RE = /^\d{4}-\d{4}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STUDENT_ID_RE = /^[A-Za-z0-9_-]+$/;

function parseOptionalBoolean(raw: string): boolean | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return false;
  if (['true', 't', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'f', 'no', 'n', '0'].includes(normalized)) return false;
  return null;
}

/**
 * Parse a raw IC CSV string. Returns clean rows + per-row errors. Header order
 * is flexible; missing headers fail the entire parse (single error at row 0).
 *
 * Empty trailing lines are silently dropped. Truly empty cells are treated as
 * missing (which fails validation for any required field).
 */
export function parseIcCsv(text: string): ParseResult {
  const errors: ImportError[] = [];
  const rows: ParsedRow[] = [];

  if (!text || !text.trim()) {
    return { rows, errors: [{ row: 0, reason: 'CSV is empty' }] };
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase()
  });

  // PapaParse field-level errors are non-fatal but worth surfacing.
  for (const e of parsed.errors ?? []) {
    if (e.row === undefined) {
      errors.push({ row: 0, reason: `csv parse error: ${e.message}` });
    } else {
      // PapaParse 0-indexes data rows; we want 1-indexed including the header (row 1).
      errors.push({ row: e.row + 2, reason: `csv parse error: ${e.message}` });
    }
  }

  const fields = (parsed.meta?.fields ?? []).map((f) => f.toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !fields.includes(h));
  if (missing.length > 0) {
    errors.push({
      row: 1,
      reason: `missing required header(s): ${missing.join(', ')}`
    });
    return { rows, errors };
  }

  parsed.data.forEach((raw, i) => {
    const rowNumber = i + 2; // 1 = header
    const get = (h: string): string => (raw[h] ?? '').toString().trim();

    const studentId = get('student_id');
    const lastName = get('last_name');
    const firstName = get('first_name');
    const gradYearRaw = get('grad_year');
    const kindRaw = get('kind').toLowerCase();
    const code = get('code');
    const yearOrDate = get('year_or_date');
    const scoreOrCredit = get('score_or_credit').toLowerCase();
    const safetyNetRaw = get('safety_net_applied');
    const safetyNetApplied = parseOptionalBoolean(safetyNetRaw);

    if (!studentId) {
      errors.push({ row: rowNumber, reason: 'student_id is required' });
      return;
    }
    if (!STUDENT_ID_RE.test(studentId)) {
      errors.push({
        row: rowNumber,
        reason: `student_id "${studentId}" must be alphanumeric (with -/_)`
      });
      return;
    }
    if (!lastName || !firstName) {
      errors.push({ row: rowNumber, reason: 'last_name and first_name are required' });
      return;
    }
    const gradYear = Number(gradYearRaw);
    if (!Number.isInteger(gradYear) || gradYear < 2024 || gradYear > 2040) {
      errors.push({
        row: rowNumber,
        reason: `grad_year "${gradYearRaw}" must be an integer 2024–2040`
      });
      return;
    }
    if (!VALID_KINDS.has(kindRaw as RowKind)) {
      errors.push({
        row: rowNumber,
        reason: `unknown kind "${kindRaw}" — expected course|regents|demographic`
      });
      return;
    }
    const kind = kindRaw as RowKind;

    // Per-kind shape validation.
    if (kind === 'course') {
      if (!code) {
        errors.push({ row: rowNumber, reason: 'course rows require a code' });
        return;
      }
      if (!SCHOOL_YEAR_RE.test(yearOrDate)) {
        errors.push({
          row: rowNumber,
          reason: `course year_or_date "${yearOrDate}" must be YYYY-YYYY`
        });
        return;
      }
      if (!VALID_CREDIT.has(scoreOrCredit)) {
        errors.push({
          row: rowNumber,
          reason: `course score_or_credit "${scoreOrCredit}" must be passed|failed|in_progress`
        });
        return;
      }
    } else if (kind === 'regents') {
      if (!code) {
        errors.push({ row: rowNumber, reason: 'regents rows require a code' });
        return;
      }
      if (!ISO_DATE_RE.test(yearOrDate)) {
        errors.push({
          row: rowNumber,
          reason: `regents year_or_date "${yearOrDate}" must be YYYY-MM-DD`
        });
        return;
      }
      // Reject things like "2025-13-40".
      const dt = new Date(yearOrDate);
      if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== yearOrDate) {
        errors.push({
          row: rowNumber,
          reason: `regents year_or_date "${yearOrDate}" is not a real calendar date`
        });
        return;
      }
      const scoreNum = Number(scoreOrCredit);
      if (!Number.isInteger(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        errors.push({
          row: rowNumber,
          reason: `regents score_or_credit "${scoreOrCredit}" must be integer 0–100`
        });
        return;
      }
      if (safetyNetApplied === null) {
        errors.push({
          row: rowNumber,
          reason: `safety_net_applied "${safetyNetRaw}" must be true/false, yes/no, or 1/0`
        });
        return;
      }
    }
    // demographic: code/year_or_date/score_or_credit all unused; left untouched.

    rows.push({
      rowNumber,
      studentId,
      lastName,
      firstName,
      gradYear,
      kind,
      code,
      yearOrDate,
      scoreOrCredit,
      safetyNetApplied: kind === 'regents' ? Boolean(safetyNetApplied) : false
    });
  });

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Preview (read-only diff)
// ---------------------------------------------------------------------------

interface ExistingStudent {
  id: string;
  last_name: string;
  first_name: string;
  grad_year: number;
}

interface ExistingEnrollment {
  student_id: string;
  course_code: string;
  school_year: string;
  credit_status: string;
}

interface ExistingRegents {
  student_id: string;
  exam_code: string;
  exam_date: string;
  score: number;
  safety_net_applied: boolean;
}

/**
 * Compare each parsed row to the live DB without writing. Counts rows as:
 *   new       — no matching existing row
 *   updated   — matching key, but at least one field differs
 *   unchanged — matching key with identical values
 */
export async function previewImport(rows: readonly ParsedRow[]): Promise<PreviewResult> {
  const sb = supabaseAdmin();

  const studentIds = Array.from(new Set(rows.map((r) => r.studentId)));
  const courseCodes = Array.from(
    new Set(rows.filter((r) => r.kind === 'course').map((r) => r.code))
  );

  const [studentsRes, catalogRes, enrollmentRes, regentsRes] = await Promise.all([
    studentIds.length === 0
      ? Promise.resolve({ data: [] as ExistingStudent[], error: null })
      : sb.from('students').select('id, last_name, first_name, grad_year').in('id', studentIds),
    courseCodes.length === 0
      ? Promise.resolve({ data: [] as { id: number; course_code: string }[], error: null })
      : sb.from('course_catalog').select('id, course_code').in('course_code', courseCodes),
    studentIds.length === 0
      ? Promise.resolve({ data: [] as { student_id: string; school_year: string; credit_status: string; course_id: number }[], error: null })
      : sb
          .from('course_enrollment')
          .select('student_id, school_year, credit_status, course_id')
          .in('student_id', studentIds),
    studentIds.length === 0
      ? Promise.resolve({ data: [] as ExistingRegents[], error: null })
      : sb
          .from('regents_scores')
          .select('student_id, exam_code, exam_date, score, safety_net_applied')
          .in('student_id', studentIds)
  ]);

  const studentsByKey = new Map<string, ExistingStudent>();
  for (const s of (studentsRes.data ?? []) as ExistingStudent[]) {
    studentsByKey.set(s.id, s);
  }
  const courseCatalogByCode = new Map<string, number>();
  for (const c of (catalogRes.data ?? []) as { id: number; course_code: string }[]) {
    courseCatalogByCode.set(c.course_code, c.id);
  }
  // course_enrollment lookup: student + course_id + school_year → credit_status
  const enrollmentByKey = new Map<string, ExistingEnrollment>();
  const courseIdToCode = new Map<number, string>();
  for (const c of (catalogRes.data ?? []) as { id: number; course_code: string }[]) {
    courseIdToCode.set(c.id, c.course_code);
  }
  for (const e of (enrollmentRes.data ?? []) as {
    student_id: string;
    school_year: string;
    credit_status: string;
    course_id: number;
  }[]) {
    const code = courseIdToCode.get(e.course_id);
    if (!code) continue;
    enrollmentByKey.set(`${e.student_id}|${code}|${e.school_year}`, {
      student_id: e.student_id,
      course_code: code,
      school_year: e.school_year,
      credit_status: e.credit_status
    });
  }
  const regentsByKey = new Map<string, ExistingRegents>();
  for (const r of (regentsRes.data ?? []) as ExistingRegents[]) {
    regentsByKey.set(`${r.student_id}|${r.exam_code}|${r.exam_date}`, r);
  }

  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const byKind = { course: 0, regents: 0, demographic: 0 };

  // Each parsed row contributes both to a student-row diff and a kind-specific
  // diff. We count each parsed row exactly once: if either the student record
  // or the kind-specific record requires a write, it's new/updated; otherwise
  // unchanged.
  // Track which student keys we've already attributed so a single new student
  // (with N course/regents rows) doesn't get N "new student" counts.
  const seenStudentDiff = new Set<string>();

  for (const row of rows) {
    byKind[row.kind] += 1;

    const studentExisting = studentsByKey.get(row.studentId);
    const studentDelta = !seenStudentDiff.has(row.studentId)
      ? !studentExisting
        ? 'new'
        : studentExisting.last_name !== row.lastName ||
          studentExisting.first_name !== row.firstName ||
          studentExisting.grad_year !== row.gradYear
        ? 'updated'
        : 'unchanged'
      : 'unchanged';
    seenStudentDiff.add(row.studentId);

    let kindDelta: 'new' | 'updated' | 'unchanged';
    if (row.kind === 'course') {
      const key = `${row.studentId}|${row.code}|${row.yearOrDate}`;
      const exist = enrollmentByKey.get(key);
      if (!exist) kindDelta = 'new';
      else if (exist.credit_status !== row.scoreOrCredit) kindDelta = 'updated';
      else kindDelta = 'unchanged';
    } else if (row.kind === 'regents') {
      const key = `${row.studentId}|${row.code}|${row.yearOrDate}`;
      const exist = regentsByKey.get(key);
      const score = Number(row.scoreOrCredit);
      if (!exist) kindDelta = 'new';
      else if (exist.score !== score || Boolean(exist.safety_net_applied) !== row.safetyNetApplied) kindDelta = 'updated';
      else kindDelta = 'unchanged';
    } else {
      // demographic: only the student row matters.
      kindDelta = 'unchanged';
    }

    // The "worst" of (studentDelta, kindDelta) wins: new > updated > unchanged.
    const order = { new: 2, updated: 1, unchanged: 0 } as const;
    const final =
      order[studentDelta] >= order[kindDelta] ? studentDelta : kindDelta;
    if (final === 'new') newCount += 1;
    else if (final === 'updated') updatedCount += 1;
    else unchangedCount += 1;
  }

  return { newCount, updatedCount, unchangedCount, byKind };
}

// ---------------------------------------------------------------------------
// Commit (writes)
// ---------------------------------------------------------------------------

/**
 * Apply parsed rows to the live DB. Strategy:
 *
 *   - students: upsert keyed by id (PK)
 *   - course_enrollment: upsert keyed by (student_id, course_id, school_year, term)
 *     — `term` defaults to '' so the unique index matches.
 *   - regents_scores: upsert keyed by (student_id, exam_code, exam_date)
 *
 * Course rows whose `code` doesn't match any course_catalog entry are
 * skipped (counted in `imported.courseEnrollment.missingCourse`) so an admin
 * can decide whether to add the course to the catalog and re-import.
 *
 * Writes one summary row to audit_log. Returns the audit log id.
 */
export async function commitImport(
  rows: readonly ParsedRow[],
  adminId: string
): Promise<CommitResult> {
  const sb = supabaseAdmin();
  const warnings: string[] = [];

  // 1. Students upsert. Last write wins on (last_name, first_name, grad_year).
  const studentMap = new Map<string, { id: string; last_name: string; first_name: string; grad_year: number }>();
  for (const r of rows) {
    studentMap.set(r.studentId, {
      id: r.studentId,
      last_name: r.lastName,
      first_name: r.firstName,
      grad_year: r.gradYear
    });
  }
  const studentRows = Array.from(studentMap.values());
  let studentsUpserted = 0;
  if (studentRows.length > 0) {
    const { error, data } = await sb
      .from('students')
      .upsert(studentRows, { onConflict: 'id' })
      .select('id');
    if (error) {
      throw new Error(`students upsert failed: ${error.message}`);
    }
    studentsUpserted = data?.length ?? studentRows.length;
  }

  // 2. Resolve course codes against course_catalog.
  const courseRows = rows.filter((r) => r.kind === 'course');
  const courseCodes = Array.from(new Set(courseRows.map((r) => r.code)));
  const codeToId = new Map<string, number>();
  if (courseCodes.length > 0) {
    const { data: catalog, error } = await sb
      .from('course_catalog')
      .select('id, course_code')
      .in('course_code', courseCodes);
    if (error) {
      throw new Error(`course_catalog lookup failed: ${error.message}`);
    }
    for (const c of (catalog ?? []) as { id: number; course_code: string }[]) {
      codeToId.set(c.course_code, c.id);
    }
  }

  // 3. course_enrollment upsert.
  const enrollmentInserts: {
    student_id: string;
    course_id: number;
    school_year: string;
    term: string;
    credit_status: string;
  }[] = [];
  let missingCourse = 0;
  for (const r of courseRows) {
    const courseId = codeToId.get(r.code);
    if (!courseId) {
      missingCourse += 1;
      warnings.push(
        `row ${r.rowNumber}: course_code "${r.code}" not found in course_catalog — skipped`
      );
      continue;
    }
    enrollmentInserts.push({
      student_id: r.studentId,
      course_id: courseId,
      school_year: r.yearOrDate,
      term: '',
      credit_status: r.scoreOrCredit
    });
  }
  let enrollmentUpserted = 0;
  if (enrollmentInserts.length > 0) {
    const { error, data } = await sb
      .from('course_enrollment')
      .upsert(enrollmentInserts, {
        onConflict: 'student_id,course_id,school_year,term'
      })
      .select('id');
    if (error) {
      throw new Error(`course_enrollment upsert failed: ${error.message}`);
    }
    enrollmentUpserted = data?.length ?? enrollmentInserts.length;
  }

  // 4. regents_scores upsert.
  const regentsRows = rows.filter((r) => r.kind === 'regents');
  const regentsInserts = regentsRows.map((r) => ({
    student_id: r.studentId,
    exam_code: r.code,
    exam_date: r.yearOrDate,
    score: Number(r.scoreOrCredit),
    safety_net_applied: r.safetyNetApplied
  }));
  let regentsUpserted = 0;
  if (regentsInserts.length > 0) {
    const { error, data } = await sb
      .from('regents_scores')
      .upsert(regentsInserts, {
        onConflict: 'student_id,exam_code,exam_date'
      })
      .select('id');
    if (error) {
      throw new Error(`regents_scores upsert failed: ${error.message}`);
    }
    regentsUpserted = data?.length ?? regentsInserts.length;
  }

  // 5. Single summary row in audit_log.
  let auditLogId: number | null = null;
  const { data: auditRow, error: auditErr } = await sb
    .from('audit_log')
    .insert({
      actor_id: adminId,
      actor_kind: 'admin',
      action: 'admin_imported_csv',
      target_type: 'import_session',
      target_id: new Date().toISOString(),
      data: {
        rows: rows.length,
        students_upserted: studentsUpserted,
        course_enrollment_upserted: enrollmentUpserted,
        regents_scores_upserted: regentsUpserted,
        course_rows_missing_catalog: missingCourse,
        by_kind: {
          course: courseRows.length,
          regents: regentsRows.length,
          demographic: rows.filter((r) => r.kind === 'demographic').length
        }
      }
    })
    .select('id')
    .single();
  if (auditErr) {
    warnings.push(`audit_log insert failed: ${auditErr.message}`);
  } else if (auditRow && typeof auditRow.id === 'number') {
    auditLogId = auditRow.id;
  }

  return {
    imported: {
      students: { upserted: studentsUpserted },
      courseEnrollment: { upserted: enrollmentUpserted, missingCourse },
      regentsScores: { upserted: regentsUpserted }
    },
    auditLogId,
    warnings
  };
}

// ---------------------------------------------------------------------------
// Reading recent imports for the admin landing page.
// ---------------------------------------------------------------------------

export interface RecentImport {
  id: number;
  occurredAt: string;
  rows: number;
  studentsUpserted: number;
  courseEnrollmentUpserted: number;
  regentsScoresUpserted: number;
}

export async function listRecentImports(limit = 10): Promise<RecentImport[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('audit_log')
    .select('id, occurred_at, data')
    .eq('action', 'admin_imported_csv')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => {
    const d = (r.data ?? {}) as Record<string, unknown>;
    return {
      id: Number(r.id),
      occurredAt: String(r.occurred_at),
      rows: Number(d.rows ?? 0),
      studentsUpserted: Number(d.students_upserted ?? 0),
      courseEnrollmentUpserted: Number(d.course_enrollment_upserted ?? 0),
      regentsScoresUpserted: Number(d.regents_scores_upserted ?? 0)
    };
  });
}
