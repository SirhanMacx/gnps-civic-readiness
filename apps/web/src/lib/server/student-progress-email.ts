/**
 * Student progress report email — sent automatically after every submission
 * if the student provided their email address.
 *
 * Pulls current point totals via the same pathway-rules engine the staff
 * portals use, so the student sees the exact number a counselor would.
 *
 * Graceful no-op when:
 *   - Student didn't provide an email
 *   - Resend is not configured (RESEND_API_KEY unset) — Phase 1 fallback
 */

import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { supabaseAdmin } from './supabase.js';
import {
  computePoints,
  isEligible,
  PATHWAYS,
  type PathwayId,
  type StudentEvidence,
  type AwardedSubmission
} from '$lib/pathway-rules/index.js';

const FROM = env.EMAIL_FROM ?? 'GNPS Civic Readiness <civicseal-gnps@resend.dev>';
const APP_URL = publicEnv.PUBLIC_APP_URL ?? 'https://gnps-civic-readiness.vercel.app';

const PATHWAY_LABELS: Record<PathwayId, string> = {
  four_ss_credits: 'Four social-studies credits',
  regents_mastery: 'Regents — Mastery (≥85)',
  regents_proficiency: 'Regents — Proficiency (65–84)',
  advanced_ss_course: 'Advanced social studies course',
  research_project: 'Research Project',
  hs_civic_project: 'High School Civic Project',
  service_learning: 'Service-Learning',
  civic_elective: 'Civic-Engagement Elective',
  ms_capstone: 'Middle School Capstone',
  wbl_extracurr: 'Work-Based Learning / Extra-curricular',
  hs_capstone: 'Civics Capstone Project'
};

interface StudentProgress {
  knowledge: number;
  participation: number;
  total: number;
  eligible: boolean;
  awardedPathways: { pathway: PathwayId; points: number }[];
  recentSubmissions: { pathwayType: string; status: string; submittedAt: string }[];
}

async function buildProgress(studentId: string): Promise<StudentProgress | null> {
  const sb = supabaseAdmin();

  const { data: enrollment } = await sb
    .from('course_enrollment')
    .select('credit_status, course_catalog!inner(counts_for, credits)')
    .eq('student_id', studentId)
    .eq('credit_status', 'passed');

  const { data: regents } = await sb
    .from('regents_scores')
    .select('exam_code, score, safety_net_applied')
    .eq('student_id', studentId);

  const { data: submissions } = await sb
    .from('pathway_submissions')
    .select('id, pathway_type, status, points_awarded, submitted_at, awarded_at')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });

  let ssCreditsPassed = 0;
  let advancedSsCount = 0;
  for (const e of enrollment ?? []) {
    const counts = ((e.course_catalog as unknown as { counts_for: string[]; credits: number })?.counts_for ?? []) as string[];
    const cred = ((e.course_catalog as unknown as { counts_for: string[]; credits: number })?.credits ?? 1) as number;
    if (counts.includes('1a')) ssCreditsPassed += Number(cred);
    if (counts.includes('1d')) advancedSsCount++;
  }

  const regentsRows = (regents ?? []).map((r) => ({
    exam: r.exam_code as 'GLOBAL_II' | 'US_HISTORY',
    score: Number(r.score),
    safetyNet: Boolean(r.safety_net_applied)
  }));

  const awarded: AwardedSubmission[] = [];
  for (const s of submissions ?? []) {
    if (s.status === 'awarded' && s.points_awarded != null) {
      const dbType = String(s.pathway_type);
      const id: PathwayId =
        dbType === 'civic_elective_essay' ? 'civic_elective' : (dbType as PathwayId);
      awarded.push({ pathway: id, points: Number(s.points_awarded) });
    }
  }

  const ev: StudentEvidence = {
    ssCreditsPassed,
    regents: regentsRows,
    advancedSsCount,
    awarded
  };
  const pts = computePoints(ev);

  return {
    knowledge: pts.knowledge,
    participation: pts.participation,
    total: pts.total,
    eligible: isEligible(pts),
    awardedPathways: awarded,
    recentSubmissions: (submissions ?? []).slice(0, 5).map((s) => ({
      pathwayType: String(s.pathway_type),
      status: String(s.status),
      submittedAt: String(s.submitted_at)
    }))
  };
}

function progressEmailHtml(input: {
  studentName: string;
  studentId: string;
  progress: StudentProgress;
  justSubmittedPathway: string;
}): string {
  const { studentName, studentId, progress, justSubmittedPathway } = input;
  const knowledgeBar = Math.min(100, (progress.knowledge / 6) * 100);
  const participationBar = Math.min(100, (progress.participation / 6) * 100);

  const eligibilityBlock = progress.eligible
    ? `<div style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:14px;border-radius:4px;margin:18px 0">
         <strong style="color:#1b5e20;font-size:15px">✓ You're eligible.</strong>
         <p style="margin:6px 0 0 0;color:#1b5e20;font-size:13px">Your counselor will confirm and the seal will be added at graduation. Keep submitting any new evidence — it strengthens your audit record.</p>
       </div>`
    : (() => {
        const needs: string[] = [];
        if (progress.knowledge < 2) needs.push(`${(2 - progress.knowledge).toFixed(1)} more from Civic Knowledge`);
        if (progress.participation < 2) needs.push(`${(2 - progress.participation).toFixed(1)} more from Civic Participation`);
        if (progress.total < 6) needs.push(`${(6 - progress.total).toFixed(1)} more total`);
        return `<div style="background:#fff3d6;border-left:4px solid #d4a017;padding:14px;border-radius:4px;margin:18px 0">
                  <strong style="color:#5a4500;font-size:15px">Not yet eligible — here's what you still need:</strong>
                  <ul style="margin:8px 0 0 18px;color:#5a4500;font-size:13px">
                    ${needs.map((n) => `<li>${n}</li>`).join('')}
                  </ul>
                </div>`;
      })();

  const awardedRows =
    progress.awardedPathways.length === 0
      ? `<tr><td colspan="2" style="padding:8px 10px;color:#888;font-size:12px;font-style:italic">No awarded points yet — keep submitting!</td></tr>`
      : progress.awardedPathways
          .map(
            (a) =>
              `<tr><td style="padding:6px 10px;font-size:13px">${PATHWAY_LABELS[a.pathway] ?? a.pathway}</td><td style="padding:6px 10px;text-align:right;font-size:13px;font-weight:600;color:#FE8158">${a.points} pt</td></tr>`
          )
          .join('');

  const recentRows = progress.recentSubmissions
    .map(
      (s) =>
        `<tr><td style="padding:5px 8px;font-size:12px">${s.pathwayType.replace(/_/g, ' ')}</td><td style="padding:5px 8px;font-size:12px;color:#666">${s.status}</td><td style="padding:5px 8px;font-size:12px;color:#888">${new Date(s.submittedAt).toLocaleDateString()}</td></tr>`
    )
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Your Seal of Civic Readiness progress</title></head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" style="background:#f7f9fc;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
  <tr><td style="background:#204A97;padding:16px 22px;color:#fff">
    <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.8">Great Neck Public Schools</div>
    <div style="font-size:18px;font-weight:600;margin-top:2px">Seal of Civic Readiness — your progress</div>
  </td></tr>
  <tr><td style="padding:24px 24px 8px 24px">
    <p style="margin:0;font-size:15px">Hi ${studentName},</p>
    <p style="margin:10px 0;font-size:14px">Thanks for your latest submission (<em>${justSubmittedPathway.replace(/_/g, ' ')}</em>). Here's where you stand toward the New York State Seal of Civic Readiness.</p>
  </td></tr>
  <tr><td style="padding:0 24px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0">
      <tr><td style="font-size:12px;color:#666;padding-bottom:4px">Civic Knowledge</td>
          <td style="font-size:12px;color:#666;padding-bottom:4px;text-align:right">${progress.knowledge.toFixed(1)} / ≥ 2</td></tr>
      <tr><td colspan="2" style="padding-bottom:8px"><div style="background:#e8eaf0;height:8px;border-radius:4px;overflow:hidden"><div style="background:#204A97;height:100%;width:${knowledgeBar}%"></div></div></td></tr>
      <tr><td style="font-size:12px;color:#666;padding-bottom:4px">Civic Participation</td>
          <td style="font-size:12px;color:#666;padding-bottom:4px;text-align:right">${progress.participation.toFixed(1)} / ≥ 2</td></tr>
      <tr><td colspan="2" style="padding-bottom:8px"><div style="background:#e8eaf0;height:8px;border-radius:4px;overflow:hidden"><div style="background:#FE8158;height:100%;width:${participationBar}%"></div></div></td></tr>
      <tr><td style="font-size:14px;color:#204A97;font-weight:600;padding-top:8px">Total</td>
          <td style="font-size:18px;color:#204A97;font-weight:700;padding-top:8px;text-align:right">${progress.total.toFixed(1)} / 6.0</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 24px">${eligibilityBlock}</td></tr>
  <tr><td style="padding:8px 24px">
    <h3 style="margin:0 0 6px 0;color:#204A97;font-size:14px">Pathways you've earned points on</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #d4d8e0;border-radius:4px;overflow:hidden">${awardedRows}</table>
  </td></tr>
  ${
    progress.recentSubmissions.length > 0
      ? `<tr><td style="padding:14px 24px 0 24px">
          <h3 style="margin:0 0 6px 0;color:#204A97;font-size:14px">Recent submissions</h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #d4d8e0;border-radius:4px;overflow:hidden">${recentRows}</table>
        </td></tr>`
      : ''
  }
  <tr><td style="padding:18px 24px 22px 24px">
    <p style="margin:0;font-size:13px;color:#444">Submit more evidence any time at <a href="${APP_URL}/submit" style="color:#204A97">${APP_URL.replace('https://', '')}/submit</a>.</p>
    <p style="margin:8px 0 0 0;font-size:12px;color:#888">Questions? Email <a href="mailto:civicseal@greatneck.k12.ny.us" style="color:#204A97">civicseal@greatneck.k12.ny.us</a> or ask your counselor for a status check at any time.</p>
    <p style="margin:14px 0 0 0;font-size:11px;color:#aaa">Student ID: ${studentId}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export interface ProgressEmailInput {
  studentId: string;
  studentEmail: string;
  studentFirstName: string;
  studentLastName: string;
  justSubmittedPathway: string;
}

export interface ProgressEmailResult {
  ok: boolean;
  reason?: 'not_configured' | 'no_email' | 'no_data' | 'send_failed';
}

export async function sendStudentProgressEmail(input: ProgressEmailInput): Promise<ProgressEmailResult> {
  if (!input.studentEmail) return { ok: false, reason: 'no_email' };

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[student-progress] Resend not configured; skipping progress report email.');
    return { ok: false, reason: 'not_configured' };
  }

  const progress = await buildProgress(input.studentId);
  if (!progress) return { ok: false, reason: 'no_data' };

  const html = progressEmailHtml({
    studentName: input.studentFirstName,
    studentId: input.studentId,
    progress,
    justSubmittedPathway: input.justSubmittedPathway
  });

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: FROM,
      to: input.studentEmail,
      subject: `Your Seal of Civic Readiness progress — ${progress.total.toFixed(1)} / 6.0`,
      html
    });
    return { ok: true };
  } catch (e) {
    console.error('[student-progress] send failed:', e);
    return { ok: false, reason: 'send_failed' };
  }
}
