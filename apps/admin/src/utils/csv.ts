/**
 * csv.ts — Tiny CSV serialiser. Escapes quotes, wraps fields containing
 * commas / quotes / newlines in double quotes, and writes a UTF-8 BOM so
 * Excel opens the file with the right encoding.
 *
 * Use this for "Export current view" buttons that should snapshot whatever
 * the user has on screen, with no backend round-trip. Server-side exports
 * (e.g. audit log full range) live elsewhere.
 */

export interface CsvColumn<T> {
  /** Column header text. */
  header: string;
  /** Function to compute the cell value for a row. Returns a printable scalar. */
  accessor: (row: T) => string | number | boolean | null | undefined;
}

/** Escapes one CSV field. */
function escape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Builds the CSV string from rows + columns. */
export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(c.accessor(row))).join(',')).join('\n');
  // \uFEFF = UTF-8 BOM. Excel uses this to detect encoding.
  return `\uFEFF${header}\n${body}`;
}

/** Triggers a browser download of the given rows + columns as a .csv file. */
export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const csv = rowsToCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
