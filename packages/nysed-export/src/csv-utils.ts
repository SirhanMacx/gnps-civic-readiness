/**
 * RFC 4180-friendly CSV escaping helpers.
 *
 * Kept in its own module so roster-csv, awarded-csv, and audit-csv can share a
 * single, well-tested escape implementation rather than re-deriving the rules.
 */

/**
 * Escape a single cell value per RFC 4180:
 *   - Wrap in double quotes if the value contains a comma, double quote, CR,
 *     or LF.
 *   - Inside a wrapped value, replace each " with "".
 *   - undefined / null collapse to the empty cell.
 */
export function csvCell(value: unknown): string {
	if (value === undefined || value === null) return '';
	const s = typeof value === 'string' ? value : String(value);
	const needsQuoting = /[",\r\n]/.test(s);
	if (!needsQuoting) return s;
	return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * Render an array of header keys + an array of objects as a CSV string with
 * CRLF line endings (including a trailing CRLF after the last record).
 */
export function csvFromRows<T extends Record<string, unknown>>(
	headers: readonly (keyof T & string)[],
	rows: readonly T[],
): string {
	const out: string[] = [];
	out.push(headers.map((h) => csvCell(h)).join(','));
	for (const row of rows) {
		out.push(headers.map((h) => csvCell(row[h])).join(','));
	}
	return out.join('\r\n') + '\r\n';
}
