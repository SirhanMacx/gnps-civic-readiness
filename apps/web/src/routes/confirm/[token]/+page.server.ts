import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { verifyToken } from '$server/email.js';
import { sql } from '$server/db.js';
import { confirmHours, disputeHours } from '$server/confirmations.js';

interface LoadResult {
  invalid: boolean;
  alreadyConfirmed?: boolean;
  alreadyDisputed?: boolean;
  hours?: number;
  organization?: string;
  dateRange?: string;
  studentName?: string;
  supervisorName?: string;
}

export const load: PageServerLoad = async ({ params, url }): Promise<LoadResult> => {
  const uuid = verifyToken(params.token);
  if (!uuid) return { invalid: true };

  // Two-table join (hours_log → pathway_submissions → students). The
  // direct-Postgres facade doesn't model embedded joins, so we pull the
  // joined columns via raw SQL.
  type LogRow = {
    id: number;
    hours: number | string;
    organization: string | null;
    activity_name: string;
    date_start: string;
    date_end: string;
    supervisor_name: string;
    confirmation_status: string;
    student_first_name: string;
    student_last_name: string;
  };

  let log: LogRow | null = null;
  try {
    const rows = (await sql()<LogRow[]>`
      select
        hl.id,
        hl.hours,
        hl.organization,
        hl.activity_name,
        hl.date_start,
        hl.date_end,
        hl.supervisor_name,
        hl.confirmation_status,
        s.first_name as student_first_name,
        s.last_name as student_last_name
      from hours_log hl
      inner join pathway_submissions ps on ps.id = hl.submission_id
      inner join students s on s.id = ps.student_id
      where hl.confirmation_token = ${uuid}::uuid
      limit 1
    `) as unknown as LogRow[];
    log = rows[0] ?? null;
  } catch (e) {
    console.error('[confirm/load] fetch error:', e instanceof Error ? e.message : String(e));
    return { invalid: true };
  }
  if (!log) return { invalid: true };

  // Note: leaving ?dispute=1 in URL doesn't auto-resolve — supervisor still
  // needs to type a reason and submit. We preserve the param so the dispute
  // disclosure can default to open via the page component.
  void url;

  return {
    invalid: false,
    alreadyConfirmed: log.confirmation_status === 'confirmed',
    alreadyDisputed: log.confirmation_status === 'disputed',
    hours: Number(log.hours),
    organization: log.organization ?? log.activity_name,
    dateRange: `${log.date_start} to ${log.date_end}`,
    studentName: `${log.student_first_name} ${log.student_last_name}`,
    supervisorName: log.supervisor_name
  };
};

export const actions: Actions = {
  confirm: async ({ params, getClientAddress }) => {
    const ip = (() => {
      try {
        return getClientAddress();
      } catch {
        return null;
      }
    })();
    const r = await confirmHours({ token: params.token, ip });
    if (!r.ok) {
      return fail(400, { confirmed: false, reason: r.reason });
    }
    return { confirmed: true };
  },

  dispute: async ({ params, request, getClientAddress }) => {
    const formData = await request.formData();
    const reasonRaw = formData.get('reason');
    const reason = typeof reasonRaw === 'string' ? reasonRaw : '';
    if (reason.trim().length < 3) {
      return fail(400, { disputed: false, reason: 'reason_too_short' });
    }
    const ip = (() => {
      try {
        return getClientAddress();
      } catch {
        return null;
      }
    })();
    const r = await disputeHours({ token: params.token, reason, ip });
    if (!r.ok) {
      return fail(400, { disputed: false, reason: r.reason });
    }
    return { disputed: true };
  }
};
