/**
 * Per-student NYSED audit-pack PDF endpoint.
 *
 * Generates a 1-page audit-record PDF for a single student using the vendored
 * nysed-export library. Counselor-gated. Streams as application/pdf with
 * Content-Disposition so the browser auto-downloads.
 */

import { error } from '@sveltejs/kit';
import { requireRole } from '$server/auth.js';
import { getStudentDetail } from '$server/student-detail.js';
import { renderStudentPdf } from '$lib/nysed-export/index.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async (event) => {
  await requireRole(event, 'counselor');

  const studentId = event.params.id;
  if (!studentId) throw error(400, 'student id required');

  const detail = await getStudentDetail(studentId);
  if (!detail) throw error(404, `student ${studentId} not found`);

  const pdfBytes = await renderStudentPdf({
    student: {
      id: detail.student.id,
      lastName: detail.student.lastName,
      firstName: detail.student.firstName,
      gradYear: detail.student.gradYear,
      status: detail.student.status,
      knowledge: detail.knowledge,
      participation: detail.participation,
      total: detail.total,
      eligible: detail.eligible
    },
    submissions: [
      ...detail.awardedSubmissions.map((s) => ({
        id: String(s.submissionId),
        pathwayType: s.pathwayType,
        status: 'awarded',
        pointsAwarded: s.pointsAwarded,
        submittedAt: s.awardedAt ?? '',
        awardedAt: s.awardedAt ?? undefined
      })),
      ...detail.pendingSubmissions.map((s) => ({
        id: String(s.submissionId),
        pathwayType: s.pathwayType,
        status: s.status,
        pointsAwarded: 0,
        submittedAt: s.submittedAt ?? s.proposedAt ?? '',
        scoredAt: s.scoredAt ?? undefined
      }))
    ],
    regents: detail.regents.map((r) => ({
      exam: r.examCode,
      score: r.score,
      examDate: r.examDate,
      safetyNet: r.safetyNetApplied
    })),
    enrollment: detail.enrollment.map((e) => ({
      courseCode: e.courseCode,
      courseTitle: e.title,
      schoolYear: e.schoolYear,
      finalGrade: e.finalGrade != null ? String(e.finalGrade) : '',
      creditStatus: e.creditStatus
    })),
    auditExcerpt: detail.auditLog.slice(0, 10).map((a) => ({
      occurredAt: a.occurredAt,
      action: a.action,
      actorKind: a.actorKind ?? '',
      targetType: 'pathway_submissions',
      targetId: ''
    }))
  });

  const filename = `${detail.student.id}_${detail.student.lastName}_${detail.student.firstName}.pdf`.replace(/\s+/g, '_');

  return new Response(pdfBytes as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store'
    }
  });
};
