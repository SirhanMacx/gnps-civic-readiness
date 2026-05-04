import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { verifyToken } from '$server/email.js';
import { supabaseAdmin } from '$server/supabase.js';
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

  const sb = supabaseAdmin();
  // Embed the join via PostgREST nested-resource syntax. Returns an object on
  // pathway_submissions because of inner-join semantics.
  const { data: log, error } = await sb
    .from('hours_log')
    .select(
      'id, hours, organization, activity_name, date_start, date_end, supervisor_name, confirmation_status, pathway_submissions!inner(student_id, students!inner(first_name, last_name))'
    )
    .eq('confirmation_token', uuid)
    .maybeSingle();

  if (error) {
    console.error('[confirm/load] fetch error:', error.message);
    return { invalid: true };
  }
  if (!log) return { invalid: true };

  // Note: leaving ?dispute=1 in URL doesn't auto-resolve — supervisor still
  // needs to type a reason and submit. We preserve the param so the dispute
  // disclosure can default to open via the page component.
  void url;

  // Supabase types `pathway_submissions` as either a row or an array depending
  // on FK config; cast loosely since we know the !inner join shape.
  const ps = (log as unknown as {
    pathway_submissions: { students: { first_name: string; last_name: string } };
  }).pathway_submissions;

  return {
    invalid: false,
    alreadyConfirmed: log.confirmation_status === 'confirmed',
    alreadyDisputed: log.confirmation_status === 'disputed',
    hours: Number(log.hours),
    organization: (log.organization ?? log.activity_name) as string,
    dateRange: `${log.date_start} to ${log.date_end}`,
    studentName: `${ps.students.first_name} ${ps.students.last_name}`,
    supervisorName: log.supervisor_name as string
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
