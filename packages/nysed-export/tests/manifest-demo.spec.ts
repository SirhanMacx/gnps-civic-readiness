import { describe, it } from 'vitest';
import { unzipSync } from 'fflate';
import { auditCsv } from '../src/audit-csv.js';
import { awardedCsv } from '../src/awarded-csv.js';
import { renderStudentPdf } from '../src/student-pdf.js';
import { rosterCsv } from '../src/roster-csv.js';
import { bundleZip } from '../src/zip-bundle.js';
import type { AuditRow, EnrollmentRow, EvidenceFile, RegentsRow, StudentRow, SubmissionRow } from '../src/types.js';

describe.skipIf(process.env.MANIFEST !== '1')('manifest demo', () => {
  it('prints the realistic audit pack', async () => {
    const students: StudentRow[] = [
      { id: 'GN20271234', lastName: 'Goldberg', firstName: 'Maya', gradYear: 2027, status: 'awarded', knowledge: 2.5, participation: 3.5, total: 6.0, eligible: true, awardedAt: '2027-05-15T13:00:00Z' },
      { id: 'GN20275511', lastName: 'Chen',     firstName: 'David', gradYear: 2027, status: 'in_progress', knowledge: 1.5, participation: 1.0, total: 2.5, eligible: false },
      { id: 'GN20279988', lastName: 'OHara',    firstName: 'Sean',  gradYear: 2027, status: 'awarded', knowledge: 3.0, participation: 3.0, total: 6.0, eligible: true, awardedAt: '2027-05-15T13:00:00Z' },
    ];
    const audit: AuditRow[] = [
      { occurredAt: '2027-04-01T10:00:00Z', action: 'submission_created', actorKind: 'student', targetType: 'pathway_submission', targetId: 's1' },
      { occurredAt: '2027-04-15T10:00:00Z', action: 'submission_awarded', actorKind: 'counselor', targetType: 'pathway_submission', targetId: 's1' },
    ];
    const submissions: SubmissionRow[] = [
      { id: 's1', pathwayType: 'service_learning', status: 'awarded', pointsAwarded: 1.5, submittedAt: '2026-10-01T12:00:00Z', awardedAt: '2026-10-20T12:00:00Z' },
      { id: 's2', pathwayType: 'hs_capstone',      status: 'awarded', pointsAwarded: 2.0, submittedAt: '2027-02-01T12:00:00Z', awardedAt: '2027-02-25T12:00:00Z' },
    ];
    const regents: RegentsRow[] = [{ exam: 'US History', score: 88, examDate: '2026-06-15', safetyNet: false }];
    const enrollment: EnrollmentRow[] = [{ courseCode: 'PART-12', courseTitle: 'Participation in Government', schoolYear: '2026-2027', finalGrade: '92', creditStatus: 'earned' }];

    const studentPdfs = new Map<string, Uint8Array>();
    for (const s of students) {
      studentPdfs.set(`${s.id}_${s.lastName}_${s.firstName}`, await renderStudentPdf({ student: s, submissions, regents, enrollment, auditExcerpt: audit }));
    }
    const evidence = new Map<string, EvidenceFile[]>();
    evidence.set('GN20271234', [
      { filename: 'service_learning_reflection.pdf', mimeType: 'application/pdf', sizeBytes: 24, kind: 'reflection',         bytes: new TextEncoder().encode('reflection content'), domainTags: ['knowledge'] },
      { filename: 'capstone_v3.pdf',                 mimeType: 'application/pdf', sizeBytes: 24, kind: 'capstone_artifact',  bytes: new TextEncoder().encode('capstone v3 artifact'), domainTags: ['skills'] },
    ]);

    const zip = bundleZip({
      studentPdfs,
      rosterCsv: rosterCsv(students),
      awardedCsv: awardedCsv(students),
      auditCsv: auditCsv(audit),
      evidenceFiles: evidence,
    });

    console.log('===AUDIT_PACK_DEMO===');
    console.log('byteLength=' + zip.byteLength);
    const ext = unzipSync(zip);
    for (const p of Object.keys(ext).sort()) {
      console.log('PATH ' + p + ' (' + ext[p]!.byteLength + ' B)');
    }
    console.log('===END===');
  });
});
