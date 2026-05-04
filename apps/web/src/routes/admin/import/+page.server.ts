/**
 * /admin/import — IC CSV upload + diff + commit.
 *
 * Two form actions:
 *   - 'parse' : FormData with a CSV file; returns parsed rows + errors + diff
 *   - 'commit': FormData with a JSON-encoded `rows` field (the rows the admin
 *               approved on step 1) and we upsert + write audit_log.
 *
 * The page uses `enhance` so step 1 stays on the same page (form action
 * returns data via `form.parsed`, step 2 returns `form.committed`).
 */

import { error, fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import {
  commitImport,
  listRecentImports,
  parseIcCsv,
  previewImport,
  type ParsedRow,
  type ImportError,
  type PreviewResult,
  type CommitResult,
  type RecentImport
} from '$server/imports.js';
import { supabaseAdmin } from '$server/supabase.js';
import { requireRole } from '$server/auth.js';

export interface PageDataExtras {
  recentImports: RecentImport[];
  catalogCount: number;
}

export const load: PageServerLoad = async () => {
  const sb = supabaseAdmin();
  const { count } = await sb
    .from('course_catalog')
    .select('id', { count: 'exact', head: true });
  let recentImports: RecentImport[] = [];
  try {
    recentImports = await listRecentImports(5);
  } catch {
    // best effort
  }
  return { recentImports, catalogCount: count ?? 0 };
};

export const actions: Actions = {
  parse: async (event) => {
    await requireRole(event, 'admin');
    const formData = await event.request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return fail(400, { parseError: 'No CSV file uploaded' });
    }
    const text = await file.text();
    const { rows, errors } = parseIcCsv(text);

    let preview: PreviewResult | null = null;
    let previewError: string | undefined;
    if (rows.length > 0) {
      try {
        preview = await previewImport(rows);
      } catch (e) {
        previewError = e instanceof Error ? e.message : String(e);
      }
    }

    return {
      parsed: {
        rows,
        errors,
        preview,
        previewError,
        filename: file.name,
        bytes: text.length
      } satisfies {
        rows: ParsedRow[];
        errors: ImportError[];
        preview: PreviewResult | null;
        previewError?: string;
        filename: string;
        bytes: number;
      }
    };
  },

  commit: async (event) => {
    const user = await requireRole(event, 'admin');
    const formData = await event.request.formData();
    const rowsField = formData.get('rows');
    if (typeof rowsField !== 'string' || !rowsField.trim()) {
      return fail(400, { commitError: 'No rows to commit' });
    }
    let rows: ParsedRow[];
    try {
      rows = JSON.parse(rowsField);
      if (!Array.isArray(rows)) throw new Error('rows must be an array');
    } catch (e) {
      return fail(400, {
        commitError: `invalid rows payload: ${e instanceof Error ? e.message : String(e)}`
      });
    }
    if (rows.length === 0) {
      return fail(400, { commitError: 'no rows to commit' });
    }

    let result: CommitResult;
    try {
      result = await commitImport(rows, user.id);
    } catch (e) {
      throw error(500, e instanceof Error ? e.message : String(e));
    }

    return { committed: result };
  }
};
