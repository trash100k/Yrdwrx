// CSV export safety. Two distinct hazards, both handled here:
//  1. Structure breakage — a value containing a comma, quote, or newline must be quoted
//     and its internal quotes doubled, or it corrupts the column layout.
//  2. Formula injection (CWE-1236) — a spreadsheet treats a cell beginning with = + - @
//     (or tab / carriage-return) as a live formula, so attacker-controlled fields like
//     "=WEBSERVICE(...)" or "=cmd|..." execute on open. We neutralize by prefixing a
//     single quote, which spreadsheets render as a literal text lead-in.
// Every user-facing CSV export MUST route each field through csvCell().

const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Escape one CSV field: neutralize formula leads, then quote + double internal quotes. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (FORMULA_LEAD.test(s)) s = "'" + s;
  // Always quote and escape — cheap, and avoids per-value delimiter sniffing mistakes.
  return '"' + s.replace(/"/g, '""') + '"';
}

/** Build a CSV row from fields, each escaped via csvCell. */
export function csvRow(fields: unknown[]): string {
  return fields.map(csvCell).join(",");
}

/**
 * Build a full CSV document string from a header row + data rows.
 * Uses CRLF line endings (Excel-friendly). Does not add a data: URI prefix —
 * callers wrap it (e.g. Blob) as needed.
 */
export function toCsv(header: string[], rows: unknown[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\r\n");
}
