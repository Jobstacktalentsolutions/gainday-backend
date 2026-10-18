/** Largest data set a CSV_DATA_PANEL task may carry: it is read on screen in a table, not analysed
 *  in a spreadsheet, so it has to stay short enough to read. Also stated to the generator. */
export const CSV_MAX_ROWS = 25;

/**
 * Parses CSV text into rows of fields (RFC 4180 style): comma-separated, fields may be wrapped in
 * double quotes to contain commas, quotes ("" is a literal quote) and line breaks. Blank lines are
 * skipped. Kept in lockstep with gainday-frontend's simulation-tasks/csv.ts, which renders it.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      endField();
    } else if (char === '\n') {
      endRow();
    } else if (char !== '\r') {
      field += char;
    }
  }
  endRow();
  return rows;
}

/** Why a CSV cannot be shown as a table, or null when it can: a header and at least one data row,
 *  at least two columns, every row as wide as the header, at most CSV_MAX_ROWS data rows. */
export function findCsvProblem(csv: string): string | null {
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return 'the CSV needs a header row and at least one data row';
  }
  const width = rows[0].length;
  if (width < 2) return 'the CSV needs at least two columns';
  if (rows[0].some((cell) => cell.trim() === '')) {
    return 'every column in the header row needs a name';
  }
  const ragged = rows.findIndex((row) => row.length !== width);
  if (ragged !== -1) {
    return `row ${ragged + 1} has ${rows[ragged].length} fields but the header has ${width}`;
  }
  if (rows.length - 1 > CSV_MAX_ROWS) {
    return `the CSV has ${rows.length - 1} data rows; the limit is ${CSV_MAX_ROWS}`;
  }
  return null;
}
