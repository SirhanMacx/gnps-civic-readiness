/**
 * Course-catalog management used by /admin/courses.
 *
 * The catalog drives 1a / 1d / 2c eligibility (see spec §4.1, §4.2, §4.3).
 * Admins can add and edit courses; SCRC members are the only role allowed to
 * approve a course (sets `scrc_approved = true`). The /admin/courses page
 * surfaces an "Approve" affordance for completeness but disables it for
 * non-SCRC users; the server still enforces the role gate here defensively.
 *
 * Every mutation writes a row to `audit_log` so the NYSED audit pack records
 * exactly which courses count and when they were blessed.
 */

import { supabaseAdmin } from './supabase.js';
import type { StaffRole } from '../../app.d.ts';

export interface Course {
  id: number;
  courseCode: string;
  title: string;
  countsFor: string[];
  credits: number;
  scrcApproved: boolean;
  scrcApprovedAt: string | null;
  scrcApprovedBy: string | null;
  createdAt: string;
}

export interface AddCourseInput {
  courseCode: string;
  title: string;
  countsFor: string[];
  credits: number;
  addedBy: string;
}

export interface EditCourseInput {
  courseId: number;
  updates: {
    courseCode?: string;
    title?: string;
    countsFor?: string[];
    credits?: number;
  };
  editorId: string;
}

export interface ApproveCourseInput {
  courseId: number;
  approverId: string;
  /** Approver's role; we 403 here if it's not 'scrc_member'. */
  approverRole: StaffRole;
}

const ALLOWED_COUNTS_FOR = new Set(['1a', '1d', '2c']);

function normalizeCountsFor(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const trimmed = v.trim();
    if (!ALLOWED_COUNTS_FOR.has(trimmed)) {
      throw new Error(`counts_for value "${v}" must be one of 1a|1d|2c`);
    }
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

function rowToCourse(r: Record<string, unknown>): Course {
  return {
    id: Number(r.id),
    courseCode: String(r.course_code ?? ''),
    title: String(r.title ?? ''),
    countsFor: Array.isArray(r.counts_for) ? r.counts_for.map(String) : [],
    credits: Number(r.credits ?? 0),
    scrcApproved: Boolean(r.scrc_approved),
    scrcApprovedAt: r.scrc_approved_at ? String(r.scrc_approved_at) : null,
    scrcApprovedBy: r.scrc_approved_by ? String(r.scrc_approved_by) : null,
    createdAt: String(r.created_at ?? '')
  };
}

export async function listCourses(): Promise<Course[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('course_catalog')
    .select(
      'id, course_code, title, counts_for, credits, scrc_approved, scrc_approved_at, scrc_approved_by, created_at'
    )
    .order('course_code', { ascending: true });
  if (error || !data) return [];
  return data.map(rowToCourse);
}

export async function addCourse(input: AddCourseInput): Promise<Course> {
  const code = input.courseCode.trim();
  const title = input.title.trim();
  if (!code) throw new Error('course_code is required');
  if (!title) throw new Error('title is required');
  if (!Number.isFinite(input.credits) || input.credits < 0 || input.credits > 10) {
    throw new Error('credits must be a non-negative number ≤ 10');
  }
  const countsFor = normalizeCountsFor(input.countsFor);

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('course_catalog')
    .insert({
      course_code: code,
      title,
      counts_for: countsFor,
      credits: input.credits,
      scrc_approved: false
    })
    .select(
      'id, course_code, title, counts_for, credits, scrc_approved, scrc_approved_at, scrc_approved_by, created_at'
    )
    .single();
  if (error || !data) {
    throw new Error(`course_catalog insert failed: ${error?.message ?? 'unknown'}`);
  }

  await sb.from('audit_log').insert({
    actor_id: input.addedBy,
    actor_kind: 'admin',
    action: 'admin_added_course',
    target_type: 'course_catalog',
    target_id: String(data.id),
    data: { course_code: code, title, counts_for: countsFor, credits: input.credits }
  });

  return rowToCourse(data);
}

export async function editCourse(input: EditCourseInput): Promise<Course> {
  const updates: Record<string, unknown> = {};
  if (input.updates.courseCode !== undefined) {
    const t = input.updates.courseCode.trim();
    if (!t) throw new Error('course_code cannot be empty');
    updates.course_code = t;
  }
  if (input.updates.title !== undefined) {
    const t = input.updates.title.trim();
    if (!t) throw new Error('title cannot be empty');
    updates.title = t;
  }
  if (input.updates.countsFor !== undefined) {
    updates.counts_for = normalizeCountsFor(input.updates.countsFor);
  }
  if (input.updates.credits !== undefined) {
    if (
      !Number.isFinite(input.updates.credits) ||
      input.updates.credits < 0 ||
      input.updates.credits > 10
    ) {
      throw new Error('credits must be a non-negative number ≤ 10');
    }
    updates.credits = input.updates.credits;
  }
  if (Object.keys(updates).length === 0) {
    throw new Error('no updates provided');
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('course_catalog')
    .update(updates)
    .eq('id', input.courseId)
    .select(
      'id, course_code, title, counts_for, credits, scrc_approved, scrc_approved_at, scrc_approved_by, created_at'
    )
    .single();
  if (error || !data) {
    throw new Error(`course_catalog update failed: ${error?.message ?? 'unknown'}`);
  }

  await sb.from('audit_log').insert({
    actor_id: input.editorId,
    actor_kind: 'admin',
    action: 'admin_edited_course',
    target_type: 'course_catalog',
    target_id: String(input.courseId),
    data: { updates }
  });

  return rowToCourse(data);
}

export async function approveCourse(input: ApproveCourseInput): Promise<Course> {
  if (input.approverRole !== 'scrc_member') {
    const e = new Error('Only SCRC members can approve courses');
    (e as Error & { status?: number }).status = 403;
    throw e;
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('course_catalog')
    .update({
      scrc_approved: true,
      scrc_approved_at: new Date().toISOString(),
      scrc_approved_by: input.approverId
    })
    .eq('id', input.courseId)
    .select(
      'id, course_code, title, counts_for, credits, scrc_approved, scrc_approved_at, scrc_approved_by, created_at'
    )
    .single();
  if (error || !data) {
    throw new Error(`course approve failed: ${error?.message ?? 'unknown'}`);
  }

  await sb.from('audit_log').insert({
    actor_id: input.approverId,
    actor_kind: 'scrc',
    action: 'scrc_approved_course',
    target_type: 'course_catalog',
    target_id: String(input.courseId),
    data: { course_code: data.course_code }
  });

  return rowToCourse(data);
}
