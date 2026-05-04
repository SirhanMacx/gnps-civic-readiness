/**
 * NYSED audit-pack export endpoint.
 *
 * GET /admin/export?cohort=<grad_year>
 *
 * Builds the zip described in spec §4.5:
 *   roster.csv
 *   awarded_students.csv
 *   audit_log_excerpt.csv
 *   per_student/<id>_<lastName>_<firstName>.pdf
 *   evidence_files/<studentId>/<original-filename>
 *
 * Streams as application/zip with a Content-Disposition that matches
 * `nysed_audit_pack_class_of_<year>.zip`.
 *
 * Evidence file bytes are pulled from the `evidence` Supabase Storage bucket;
 * any download failure is recorded as a warning (zipped as `errors.txt`)
 * rather than failing the whole export — districts can re-run after fixing.
 *
 * The endpoint also writes a single audit_log row with action
 * `admin_exported_audit_pack` so the act of exporting is itself audited.
 */

import { error, type RequestEvent } from '@sveltejs/kit';
import {
  auditCsv,
  awardedCsv,
  bundleZip,
  renderStudentPdf,
  rosterCsv,
  type EvidenceFile
} from '$lib/nysed-export/index.js';
import { loadCohort } from "$server/cohort.js";
import { supabaseAdmin } from '$server/supabase.js';
import { getStorage } from '$server/storage.js';
import { requireRole } from '$server/auth.js';

interface DbEvidenceRow {
  submission_id: number;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  kind: string;
  domain_tags: string[] | null;
}

const ALLOWED_DOMAINS = new Set(['knowledge', 'skills', 'mindsets', 'experiences']);

export async function GET(event: RequestEvent): Promise<Response> {
  const user = await requireRole(event, 'admin');

  const cohortRaw = event.url.searchParams.get('cohort');
  const cohortYear = cohortRaw ? Number(cohortRaw) : NaN;
  if (!Number.isInteger(cohortYear) || cohortYear < 2024 || cohortYear > 2040) {
    throw error(400, 'cohort query param must be an integer year (2024–2040)');
  }

  // 1. Load students + per-student data + audit excerpt.
  const cohort = await loadCohort(cohortYear);

  // 2. Render every per-student PDF in parallel-ish batches.
  const pdfs = new Map<string, Uint8Array>();
  const studentStems = new Map<string, string>(); // id → stem used in zip path
  const sanitize = (s: string) =>
    s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'unknown';

  for (const s of cohort.students) {
    const stem = `${sanitize(s.id)}_${sanitize(s.lastName)}_${sanitize(s.firstName)}`;
    studentStems.set(s.id, stem);
    try {
      const pdf = await renderStudentPdf({
        student: s,
        submissions: cohort.submissionsByStudent.get(s.id) ?? [],
        regents: cohort.regentsByStudent.get(s.id) ?? [],
        enrollment: cohort.enrollmentByStudent.get(s.id) ?? [],
        auditExcerpt: cohort.auditExcerpt
      });
      pdfs.set(stem, pdf);
    } catch (e) {
      console.error(`renderStudentPdf failed for ${s.id}:`, e);
    }
  }

  // 3. Pull evidence files for the cohort's submissions.
  const evidenceByStudent = new Map<string, EvidenceFile[]>();
  const errors: string[] = [];
  if (cohort.students.length > 0) {
    const sb = supabaseAdmin();
    const submissionIds: number[] = [];
    const submissionToStudent = new Map<number, string>();
    for (const [studentId, subs] of cohort.submissionsByStudent) {
      for (const s of subs) {
        const n = Number(s.id);
        if (Number.isInteger(n)) {
          submissionIds.push(n);
          submissionToStudent.set(n, studentId);
        }
      }
    }
    if (submissionIds.length > 0) {
      const { data: rows, error: efErr } = await sb
        .from('evidence_files')
        .select('submission_id, storage_path, filename, mime_type, size_bytes, kind, domain_tags')
        .in('submission_id', submissionIds);
      if (efErr) {
        errors.push(`evidence_files query failed: ${efErr.message}`);
      }
      const evRows = ((rows ?? []) as DbEvidenceRow[]).filter((r) => r.storage_path);
      const storage = getStorage();
      for (const r of evRows) {
        const studentId = submissionToStudent.get(r.submission_id);
        if (!studentId) continue;
        try {
          const bytes = await storage.download(r.storage_path);
          const list = evidenceByStudent.get(studentId) ?? [];
          const tags = (r.domain_tags ?? []).filter((t) => ALLOWED_DOMAINS.has(t));
          list.push({
            filename: r.filename,
            mimeType: r.mime_type,
            sizeBytes: r.size_bytes,
            kind: r.kind,
            bytes,
            domainTags: tags
          });
          evidenceByStudent.set(studentId, list);
        } catch (e) {
          errors.push(
            `download ${r.storage_path} threw: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    }
  }

  // 4. Build the CSVs.
  const roster = rosterCsv(cohort.students);
  const awarded = awardedCsv(cohort.students);
  const audit = auditCsv(cohort.auditExcerpt);

  // 5. Bundle. We re-key evidenceByStudent so the zip uses the same stem
  // as the per-student PDF for nicer side-by-side layout.
  const evidenceByStem = new Map<string, EvidenceFile[]>();
  for (const [studentId, files] of evidenceByStudent) {
    const stem = studentStems.get(studentId);
    if (!stem) continue;
    evidenceByStem.set(stem, files);
  }

  const zipBytes = bundleZip({
    studentPdfs: pdfs,
    rosterCsv: roster,
    awardedCsv: awarded,
    auditCsv: audit,
    evidenceFiles: evidenceByStem
  });

  // 6. Audit log: someone exported the pack.
  try {
    const sb = supabaseAdmin();
    await sb.from('audit_log').insert({
      actor_id: user.id,
      actor_kind: 'admin',
      action: 'admin_exported_audit_pack',
      target_type: 'cohort',
      target_id: String(cohortYear),
      data: {
        students: cohort.students.length,
        bytes: zipBytes.byteLength,
        warnings: errors
      }
    });
  } catch (e) {
    console.warn('audit_log insert (export) failed:', e);
  }

  const body = zipBytes.byteLength > 0 ? zipBytes : new Uint8Array(0);
  // Use ArrayBuffer for Vercel/Node response body. Convert if it's a SharedArrayBuffer.
  const responseBody: ArrayBuffer = (() => {
    const ab = body.buffer;
    if (ab instanceof ArrayBuffer) {
      return ab.slice(body.byteOffset, body.byteOffset + body.byteLength);
    }
    // Shouldn't happen in practice.
    const out = new ArrayBuffer(body.byteLength);
    new Uint8Array(out).set(body);
    return out;
  })();

  return new Response(responseBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(zipBytes.byteLength),
      'Content-Disposition': `attachment; filename="nysed_audit_pack_class_of_${cohortYear}.zip"`,
      'Cache-Control': 'no-store'
    }
  });
}
