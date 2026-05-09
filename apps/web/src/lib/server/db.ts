/**
 * Direct-Postgres data layer for the GNPS Civic Readiness Portal.
 *
 * Two exports:
 *
 *   1. `sql` — getter for the singleton `postgres` tagged-template client.
 *      Use this for joins, OR-conditions, or any query that doesn't fit the
 *      small builder API below. Reads `DATABASE_URL`, opts into
 *      `ssl: 'require'` only when `PGSSL=true`. The internal Docker Compose
 *      Postgres service does not use TLS; managed Postgres instances usually do.
 *      `NODE_ENV` is intentionally not used here — Docker production sets
 *      NODE_ENV=production but talks to the internal db over plaintext.
 *
 *   2. `db.from(table)` — a tiny chainable query builder that mirrors the
 *      narrow subset of `supabase-js` we actually use. Just enough to keep
 *      every call site compiling unchanged: select / eq / neq / in / ilike /
 *      gte / lte / is / order / limit / range / maybeSingle / single,
 *      insert / update / delete / upsert.
 *
 * Important constraints:
 *   - All values are passed via parameterized queries; user data is never
 *     string-interpolated. We use `sql.unsafe(text, params)` for the
 *     dynamic-WHERE case (placeholder positions are managed by the builder
 *     itself).
 *   - Identifier-like inputs (table names, column names, `onConflict` columns)
 *     are restricted to a strict regex — they're code-controlled, never
 *     user input, but defending against future drift is cheap.
 *   - Errors are returned as `{ data: null, error }` to match the shape that
 *     existing call sites already destructure. The error carries `message`
 *     and (when available) `code`.
 *
 * Joins like `course_catalog!inner(...)` are NOT supported by this builder.
 * Call sites that need them have been rewritten to use raw `sql\`...\``
 * (see roster.ts, cohort.ts, student-detail.ts, scrc.ts, confirm/[token]).
 */

import postgres from 'postgres';
import type { Sql } from 'postgres';
import { env } from '$env/dynamic/private';

// ---------------------------------------------------------------------------
// Singleton Postgres client
// ---------------------------------------------------------------------------

let cached: Sql | null = null;

/**
 * Internal: build (or fetch) the singleton postgres client.
 */
function getClient(): Sql {
  if (cached) return cached;
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set — point it at a Postgres connection string ' +
        '(e.g. postgres://civicseal:civicseal@localhost:5432/civicseal).'
    );
  }
  const requireSsl = (env.PGSSL ?? 'false').toLowerCase() === 'true';
  cached = postgres(url, {
    ssl: requireSsl ? 'require' : false,
    max: 10,
    transform: { undefined: null },
    onnotice: () => undefined
  });
  return cached;
}

/**
 * The postgres.js tagged-template client. Two valid call shapes:
 *
 *   await sql\`select 1\`                          // tagged template
 *   await sql<{ id: number }[]>\`select id ...\`    // typed-result tagged template
 *
 * Internally cached. Created on first reference. Safe to call from anywhere
 * the SvelteKit `$env/dynamic/private` is wired (i.e. server modules only).
 *
 * Implementation: a Proxy that lazily materializes the postgres client on
 * the first method/call access. We type-cast to `Sql` so call sites get full
 * typing for tagged-template invocations.
 *
 * Most call sites use `sql\`...\`` directly. The internal facade in this
 * module uses `getSql()` to grab the underlying client for `unsafe(...)` calls.
 */
export function getSql(): Sql {
  return getClient();
}

export const sql: Sql = new Proxy(
  function sqlProxy() {
    return getClient();
  } as unknown as Sql,
  {
    apply(_target, _thisArg, args: unknown[]) {
      const c = getClient() as unknown as (...a: unknown[]) => unknown;
      return c(...args);
    },
    get(_target, prop, _receiver) {
      const c = getClient() as unknown as Record<string | symbol, unknown>;
      const v = c[prop];
      if (typeof v === 'function') return (v as (...a: unknown[]) => unknown).bind(c);
      return v;
    }
  }
) as Sql;

// ---------------------------------------------------------------------------
// Identifier validation
// ---------------------------------------------------------------------------

/** Permissive identifier regex — letters, digits, underscores. */
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(name: string, kind: 'table' | 'column'): string {
  if (!IDENT_RE.test(name)) {
    throw new Error(`Invalid ${kind} identifier: ${name}`);
  }
  return `"${name}"`;
}

/**
 * Translate a comma-separated select-list (supabase-js convention) into a
 * SQL identifier list. Supports a single `*` and bare column names. Refuses
 * any join-like syntax such as `foo!inner(...)`.
 */
function parseSelectCols(cols: string | undefined): string {
  if (!cols || cols.trim() === '*' || cols.trim() === '') return '*';
  if (cols.includes('!')) {
    throw new Error(
      `select(${JSON.stringify(cols)}) — embedded joins are not ` +
        'supported by this facade. Use raw sql`...` instead.'
    );
  }
  if (cols.includes('(')) {
    throw new Error(
      `select(${JSON.stringify(cols)}) — nested resource selection ` +
        'is not supported by this facade. Use raw sql`...` instead.'
    );
  }
  return cols
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .map((c) => (c === '*' ? '*' : quoteIdent(c, 'column')))
    .join(', ');
}

// ---------------------------------------------------------------------------
// Filter / clause helpers
// ---------------------------------------------------------------------------

/**
 * A WHERE-clause filter accumulator. Each `Filter` contributes a SQL fragment
 * with `$N` placeholders; the builder concatenates them with `AND` and
 * threads the parameter list through `sql.unsafe`.
 */
interface Filter {
  /** SQL fragment using `$<n>` placeholders. */
  fragment: (offset: number) => { text: string; params: unknown[] };
}

function eqFilter(col: string, val: unknown): Filter {
  const c = quoteIdent(col, 'column');
  return {
    fragment: (i) => ({ text: `${c} = $${i + 1}`, params: [val] })
  };
}
function neqFilter(col: string, val: unknown): Filter {
  const c = quoteIdent(col, 'column');
  return {
    fragment: (i) => ({ text: `${c} <> $${i + 1}`, params: [val] })
  };
}
function inFilter(col: string, vals: readonly unknown[]): Filter {
  const c = quoteIdent(col, 'column');
  if (vals.length === 0) {
    return { fragment: () => ({ text: 'false', params: [] }) };
  }
  return {
    fragment: (i) => ({
      text: `${c} = ANY($${i + 1})`,
      params: [vals]
    })
  };
}
function ilikeFilter(col: string, val: string): Filter {
  const c = quoteIdent(col, 'column');
  return {
    fragment: (i) => ({ text: `${c} ILIKE $${i + 1}`, params: [val] })
  };
}
function gteFilter(col: string, val: unknown): Filter {
  const c = quoteIdent(col, 'column');
  return {
    fragment: (i) => ({ text: `${c} >= $${i + 1}`, params: [val] })
  };
}
function lteFilter(col: string, val: unknown): Filter {
  const c = quoteIdent(col, 'column');
  return {
    fragment: (i) => ({ text: `${c} <= $${i + 1}`, params: [val] })
  };
}
function isFilter(col: string, val: null | boolean): Filter {
  const c = quoteIdent(col, 'column');
  if (val === null) {
    return { fragment: () => ({ text: `${c} IS NULL`, params: [] }) };
  }
  return {
    fragment: () => ({ text: `${c} IS ${val ? 'TRUE' : 'FALSE'}`, params: [] })
  };
}

interface CompiledClause {
  text: string;
  params: unknown[];
}

function compileWhere(filters: readonly Filter[], paramOffset = 0): CompiledClause {
  if (filters.length === 0) return { text: '', params: [] };
  const parts: string[] = [];
  const params: unknown[] = [];
  let offset = paramOffset;
  for (const f of filters) {
    const piece = f.fragment(offset);
    parts.push(piece.text);
    params.push(...piece.params);
    offset += piece.params.length;
  }
  return { text: 'WHERE ' + parts.join(' AND '), params };
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class DbError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function toError(e: unknown): DbError {
  if (e instanceof Error) {
    const code = (e as { code?: string }).code;
    return new DbError(e.message, code);
  }
  return new DbError(String(e));
}

interface QueryResult<T> {
  data: T | null;
  error: DbError | null;
  count?: number;
}

// ---------------------------------------------------------------------------
// Select chain
// ---------------------------------------------------------------------------

interface SelectChain<Row = Record<string, unknown>> {
  eq(col: string, val: unknown): SelectChain<Row>;
  neq(col: string, val: unknown): SelectChain<Row>;
  in(col: string, vals: readonly unknown[]): SelectChain<Row>;
  ilike(col: string, val: string): SelectChain<Row>;
  gte(col: string, val: unknown): SelectChain<Row>;
  lte(col: string, val: unknown): SelectChain<Row>;
  is(col: string, val: null | boolean): SelectChain<Row>;
  /** Not implemented; throws. Rewrite to raw `sql\`...\`` for the few sites that need OR. */
  or(expr: string): SelectChain<Row>;
  order(col: string, opts: { ascending?: boolean }): SelectChain<Row>;
  limit(n: number): SelectChain<Row>;
  range(start: number, end: number): SelectChain<Row>;
  maybeSingle(): Promise<QueryResult<Row>>;
  single(): Promise<QueryResult<Row>>;
  then<R = QueryResult<Row[]>>(
    onF?: (v: QueryResult<Row[]>) => R | PromiseLike<R>,
    onR?: (e: unknown) => R | PromiseLike<R>
  ): Promise<R>;
}

interface SelectInit {
  table: string;
  cols: string;
  count?: { exact: true; head?: boolean };
}

function makeSelect(init: SelectInit): SelectChain {
  const filters: Filter[] = [];
  let orderCol: string | null = null;
  let orderAsc = true;
  let limit: number | null = null;
  let offset: number | null = null;

  function buildSelectSql(): { text: string; params: unknown[] } {
    const t = quoteIdent(init.table, 'table');
    const where = compileWhere(filters);
    let trailer = '';
    if (orderCol) {
      trailer += ` ORDER BY ${quoteIdent(orderCol, 'column')} ${orderAsc ? 'ASC' : 'DESC'}`;
    }
    if (typeof limit === 'number') trailer += ` LIMIT ${Number(limit)}`;
    if (typeof offset === 'number') trailer += ` OFFSET ${Number(offset)}`;
    return {
      text: `SELECT ${init.cols} FROM ${t} ${where.text}${trailer}`,
      params: where.params
    };
  }

  function buildCountSql(): { text: string; params: unknown[] } {
    const t = quoteIdent(init.table, 'table');
    const where = compileWhere(filters);
    return {
      text: `SELECT COUNT(*)::int AS c FROM ${t} ${where.text}`,
      params: where.params
    };
  }

  const chain: SelectChain = {
    eq(col, val) {
      filters.push(eqFilter(col, val));
      return chain;
    },
    neq(col, val) {
      filters.push(neqFilter(col, val));
      return chain;
    },
    in(col, vals) {
      filters.push(inFilter(col, vals));
      return chain;
    },
    ilike(col, val) {
      filters.push(ilikeFilter(col, val));
      return chain;
    },
    gte(col, val) {
      filters.push(gteFilter(col, val));
      return chain;
    },
    lte(col, val) {
      filters.push(lteFilter(col, val));
      return chain;
    },
    is(col, val) {
      filters.push(isFilter(col, val));
      return chain;
    },
    or() {
      throw new Error(
        'db.from(...).or(...) is not supported by this facade. Use raw sql`...` instead.'
      );
    },
    order(col, opts) {
      orderCol = col;
      orderAsc = opts.ascending !== false;
      return chain;
    },
    limit(n) {
      limit = n;
      return chain;
    },
    range(start, end) {
      offset = start;
      limit = end - start + 1;
      return chain;
    },
    async maybeSingle() {
      try {
        const s = getSql();
        const q = buildSelectSql();
        const rows = (await s.unsafe(q.text, q.params as never[])) as unknown as Record<string, unknown>[];
        if (rows.length === 0) return { data: null, error: null };
        if (rows.length > 1) {
          return {
            data: null,
            error: new DbError(
              `maybeSingle expected at most 1 row, got ${rows.length}`,
              'PGRST116'
            )
          };
        }
        return { data: rows[0]!, error: null };
      } catch (e) {
        return { data: null, error: toError(e) };
      }
    },
    async single() {
      try {
        const s = getSql();
        const q = buildSelectSql();
        const rows = (await s.unsafe(q.text, q.params as never[])) as unknown as Record<string, unknown>[];
        if (rows.length !== 1) {
          return {
            data: null,
            error: new DbError(
              `single expected exactly 1 row, got ${rows.length}`,
              'PGRST116'
            )
          };
        }
        return { data: rows[0]!, error: null };
      } catch (e) {
        return { data: null, error: toError(e) };
      }
    },
    then(onF, onR) {
      const run = async (): Promise<QueryResult<Record<string, unknown>[]>> => {
        try {
          const s = getSql();
          if (init.count?.exact) {
            const c = buildCountSql();
            const cRows = (await s.unsafe(c.text, c.params as never[])) as unknown as { c: number }[];
            const count = Number(cRows[0]?.c ?? 0);
            if (init.count.head) {
              return { data: null, error: null, count };
            }
            const q = buildSelectSql();
            const rows = (await s.unsafe(q.text, q.params as never[])) as unknown as Record<string, unknown>[];
            return { data: rows, error: null, count };
          }
          const q = buildSelectSql();
          const rows = (await s.unsafe(q.text, q.params as never[])) as unknown as Record<string, unknown>[];
          return { data: rows, error: null };
        } catch (e) {
          return { data: null, error: toError(e) };
        }
      };
      return run().then(onF, onR);
    }
  };
  return chain;
}

// ---------------------------------------------------------------------------
// Insert chain
// ---------------------------------------------------------------------------

interface InsertChain<Row = Record<string, unknown>> {
  select(cols?: string): InsertChain<Row>;
  single(): Promise<QueryResult<Row>>;
  then<R = QueryResult<Row[]>>(
    onF?: (v: QueryResult<Row[]>) => R | PromiseLike<R>,
    onR?: (e: unknown) => R | PromiseLike<R>
  ): Promise<R>;
}

function buildInsertSql(
  table: string,
  rows: readonly Record<string, unknown>[],
  returningCols: string
): { text: string; params: unknown[] } {
  const t = quoteIdent(table, 'table');
  // Collect the union of all columns across the batch so every row binds the same column list.
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const colList = cols.map((c) => quoteIdent(c, 'column')).join(', ');

  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const r of rows) {
    const placeholders: string[] = [];
    for (const c of cols) {
      params.push(c in r ? r[c] : null);
      placeholders.push(`$${params.length}`);
    }
    tuples.push(`(${placeholders.join(', ')})`);
  }
  const returning = returningCols === '*' ? '*' : returningCols;
  return {
    text: `INSERT INTO ${t} (${colList}) VALUES ${tuples.join(', ')} RETURNING ${returning}`,
    params
  };
}

function makeInsert(table: string, payload: Record<string, unknown> | readonly Record<string, unknown>[]): InsertChain {
  const rows = Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [payload as Record<string, unknown>];
  let returningCols = '*';

  const chain: InsertChain = {
    select(cols) {
      returningCols = parseSelectCols(cols);
      return chain;
    },
    async single() {
      try {
        if (rows.length === 0) {
          return {
            data: null,
            error: new DbError('insert(...).single() called with no rows', 'PGRST101')
          };
        }
        const s = getSql();
        const q = buildInsertSql(table, [rows[0]!], returningCols);
        const out = (await s.unsafe(q.text, q.params as never[])) as unknown as Record<string, unknown>[];
        if (out.length !== 1) {
          return {
            data: null,
            error: new DbError(
              `insert.single expected exactly 1 row, got ${out.length}`,
              'PGRST116'
            )
          };
        }
        return { data: out[0]!, error: null };
      } catch (e) {
        return { data: null, error: toError(e) };
      }
    },
    then(onF, onR) {
      const run = async (): Promise<QueryResult<Record<string, unknown>[]>> => {
        try {
          if (rows.length === 0) return { data: [], error: null };
          const s = getSql();
          const q = buildInsertSql(table, rows, returningCols);
          const out = (await s.unsafe(q.text, q.params as never[])) as unknown as Record<string, unknown>[];
          return { data: out, error: null };
        } catch (e) {
          return { data: null, error: toError(e) };
        }
      };
      return run().then(onF, onR);
    }
  };
  return chain;
}

// ---------------------------------------------------------------------------
// Update chain
// ---------------------------------------------------------------------------

interface UpdateChain<Row = Record<string, unknown>> {
  eq(col: string, val: unknown): UpdateChain<Row>;
  neq(col: string, val: unknown): UpdateChain<Row>;
  in(col: string, vals: readonly unknown[]): UpdateChain<Row>;
  is(col: string, val: null | boolean): UpdateChain<Row>;
  select(cols?: string): UpdateChain<Row>;
  single(): Promise<QueryResult<Row>>;
  then<R = QueryResult<Row[]>>(
    onF?: (v: QueryResult<Row[]>) => R | PromiseLike<R>,
    onR?: (e: unknown) => R | PromiseLike<R>
  ): Promise<R>;
}

function buildUpdateSql(
  table: string,
  patch: Record<string, unknown>,
  filters: readonly Filter[],
  returningCols: string | null
): { text: string; params: unknown[] } {
  const t = quoteIdent(table, 'table');
  const params: unknown[] = [];
  const setParts: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    params.push(v);
    setParts.push(`${quoteIdent(k, 'column')} = $${params.length}`);
  }
  const where = compileWhere(filters, params.length);
  params.push(...where.params);
  const returning = returningCols === null ? '' : ` RETURNING ${returningCols}`;
  return {
    text: `UPDATE ${t} SET ${setParts.join(', ')} ${where.text}${returning}`,
    params
  };
}

function makeUpdate(table: string, patch: Record<string, unknown>): UpdateChain {
  const filters: Filter[] = [];
  let returningCols: string | null = null;

  const chain: UpdateChain = {
    eq(col, val) {
      filters.push(eqFilter(col, val));
      return chain;
    },
    neq(col, val) {
      filters.push(neqFilter(col, val));
      return chain;
    },
    in(col, vals) {
      filters.push(inFilter(col, vals));
      return chain;
    },
    is(col, val) {
      filters.push(isFilter(col, val));
      return chain;
    },
    select(cols) {
      returningCols = parseSelectCols(cols);
      return chain;
    },
    async single() {
      try {
        const s = getSql();
        const q = buildUpdateSql(table, patch, filters, returningCols ?? '*');
        const out = (await s.unsafe(q.text, q.params as never[])) as unknown as Record<string, unknown>[];
        if (out.length !== 1) {
          return {
            data: null,
            error: new DbError(
              `update.single expected exactly 1 row, got ${out.length}`,
              'PGRST116'
            )
          };
        }
        return { data: out[0]!, error: null };
      } catch (e) {
        return { data: null, error: toError(e) };
      }
    },
    then(onF, onR) {
      const run = async (): Promise<QueryResult<Record<string, unknown>[]>> => {
        try {
          const s = getSql();
          const q = buildUpdateSql(table, patch, filters, returningCols);
          const out = (await s.unsafe(q.text, q.params as never[])) as unknown as Record<string, unknown>[];
          return { data: out, error: null };
        } catch (e) {
          return { data: null, error: toError(e) };
        }
      };
      return run().then(onF, onR);
    }
  };
  return chain;
}

// ---------------------------------------------------------------------------
// Delete chain
// ---------------------------------------------------------------------------

interface DeleteChain {
  eq(col: string, val: unknown): DeleteChain;
  in(col: string, vals: readonly unknown[]): DeleteChain;
  then<R = QueryResult<Record<string, unknown>[]>>(
    onF?: (v: QueryResult<Record<string, unknown>[]>) => R | PromiseLike<R>,
    onR?: (e: unknown) => R | PromiseLike<R>
  ): Promise<R>;
}

function makeDelete(table: string): DeleteChain {
  const filters: Filter[] = [];
  const chain: DeleteChain = {
    eq(col, val) {
      filters.push(eqFilter(col, val));
      return chain;
    },
    in(col, vals) {
      filters.push(inFilter(col, vals));
      return chain;
    },
    then(onF, onR) {
      const run = async (): Promise<QueryResult<Record<string, unknown>[]>> => {
        try {
          const s = getSql();
          const t = quoteIdent(table, 'table');
          const where = compileWhere(filters);
          await s.unsafe(`DELETE FROM ${t} ${where.text}`, where.params as never[]);
          return { data: [], error: null };
        } catch (e) {
          return { data: null, error: toError(e) };
        }
      };
      return run().then(onF, onR);
    }
  };
  return chain;
}

// ---------------------------------------------------------------------------
// Upsert chain
// ---------------------------------------------------------------------------

interface UpsertChain<Row = Record<string, unknown>> {
  select(cols?: string): UpsertChain<Row>;
  single(): Promise<QueryResult<Row>>;
  then<R = QueryResult<Row[]>>(
    onF?: (v: QueryResult<Row[]>) => R | PromiseLike<R>,
    onR?: (e: unknown) => R | PromiseLike<R>
  ): Promise<R>;
}

function buildUpsertSql(
  table: string,
  rows: readonly Record<string, unknown>[],
  conflictCols: readonly string[],
  returningCols: string
): { text: string; params: unknown[] } {
  const t = quoteIdent(table, 'table');
  const allCols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const colList = allCols.map((c) => quoteIdent(c, 'column')).join(', ');

  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const r of rows) {
    const placeholders: string[] = [];
    for (const c of allCols) {
      params.push(c in r ? r[c] : null);
      placeholders.push(`$${params.length}`);
    }
    tuples.push(`(${placeholders.join(', ')})`);
  }
  const conflictExpr = conflictCols.map((c) => quoteIdent(c, 'column')).join(', ');
  const updateCols = allCols.filter((c) => !conflictCols.includes(c));
  let setExpr: string;
  if (updateCols.length === 0) {
    // No-op update; keep `on conflict do nothing` semantics by referencing the conflict col.
    const c = quoteIdent(conflictCols[0]!, 'column');
    setExpr = `${c} = excluded.${c}`;
  } else {
    setExpr = updateCols.map((c) => `${quoteIdent(c, 'column')} = excluded.${quoteIdent(c, 'column')}`).join(', ');
  }
  return {
    text:
      `INSERT INTO ${t} (${colList}) VALUES ${tuples.join(', ')} ` +
      `ON CONFLICT (${conflictExpr}) DO UPDATE SET ${setExpr} RETURNING ${returningCols}`,
    params
  };
}

function makeUpsert(
  table: string,
  payload: Record<string, unknown> | readonly Record<string, unknown>[],
  options: { onConflict: string }
): UpsertChain {
  const rows = Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [payload as Record<string, unknown>];
  let returningCols = '*';

  const conflictCols = options.onConflict
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  if (conflictCols.length === 0) {
    throw new Error('upsert(...) requires onConflict with at least one column');
  }
  for (const c of conflictCols) {
    if (!IDENT_RE.test(c)) throw new Error(`Invalid onConflict column identifier: ${c}`);
  }

  const chain: UpsertChain = {
    select(cols) {
      returningCols = parseSelectCols(cols);
      return chain;
    },
    async single() {
      try {
        if (rows.length === 0) {
          return {
            data: null,
            error: new DbError('upsert(...).single() called with no rows', 'PGRST101')
          };
        }
        const s = getSql();
        const q = buildUpsertSql(table, [rows[0]!], conflictCols, returningCols);
        const out = (await s.unsafe(q.text, q.params as never[])) as unknown as Record<string, unknown>[];
        if (out.length !== 1) {
          return {
            data: null,
            error: new DbError(
              `upsert.single expected exactly 1 row, got ${out.length}`,
              'PGRST116'
            )
          };
        }
        return { data: out[0]!, error: null };
      } catch (e) {
        return { data: null, error: toError(e) };
      }
    },
    then(onF, onR) {
      const run = async (): Promise<QueryResult<Record<string, unknown>[]>> => {
        try {
          if (rows.length === 0) return { data: [], error: null };
          const s = getSql();
          const q = buildUpsertSql(table, rows, conflictCols, returningCols);
          const out = (await s.unsafe(q.text, q.params as never[])) as unknown as Record<string, unknown>[];
          return { data: out, error: null };
        } catch (e) {
          return { data: null, error: toError(e) };
        }
      };
      return run().then(onF, onR);
    }
  };
  return chain;
}

// ---------------------------------------------------------------------------
// Top-level facade
// ---------------------------------------------------------------------------

export interface DbTableQuery {
  select(cols?: string, opts?: { count?: 'exact'; head?: boolean }): SelectChain;
  insert(payload: Record<string, unknown> | readonly Record<string, unknown>[]): InsertChain;
  update(patch: Record<string, unknown>): UpdateChain;
  delete(): DeleteChain;
  upsert(
    payload: Record<string, unknown> | readonly Record<string, unknown>[],
    opts: { onConflict: string }
  ): UpsertChain;
}

export function from(table: string): DbTableQuery {
  if (!IDENT_RE.test(table)) {
    throw new Error(`Invalid table identifier: ${table}`);
  }
  return {
    select(cols, opts) {
      return makeSelect({
        table,
        cols: parseSelectCols(cols),
        count: opts?.count === 'exact' ? { exact: true, head: opts?.head } : undefined
      });
    },
    insert(payload) {
      return makeInsert(table, payload);
    },
    update(patch) {
      return makeUpdate(table, patch);
    },
    delete() {
      return makeDelete(table);
    },
    upsert(payload, opts) {
      return makeUpsert(table, payload, opts);
    }
  };
}

/**
 * Convenience export — `db.from('students').select('*').eq(...)`.
 * Mirrors supabase-js access patterns so call sites can swap with minimal diff.
 */
export const db = { from };
