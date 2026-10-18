import { CSV_MAX_ROWS, findCsvProblem, parseCsv } from './csv.util';

describe('parseCsv', () => {
  it('splits rows and fields', () => {
    expect(parseCsv('a,b\n1,2\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('handles CRLF line endings and skips blank lines', () => {
    expect(parseCsv('a,b\r\n\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps commas, doubled quotes and line breaks inside quoted fields', () => {
    expect(parseCsv('name,note\n"Smith, J","said ""hi""\nthen left"')).toEqual([
      ['name', 'note'],
      ['Smith, J', 'said "hi"\nthen left'],
    ]);
  });
});

describe('findCsvProblem', () => {
  it('accepts a header with data rows of the same width', () => {
    expect(findCsvProblem('a,b\n1,2')).toBeNull();
  });

  it('rejects a header with no data', () => {
    expect(findCsvProblem('a,b')).toContain(
      'header row and at least one data row',
    );
  });

  it('rejects a single column', () => {
    expect(findCsvProblem('a\n1')).toContain('two columns');
  });

  it('rejects an unnamed column', () => {
    expect(findCsvProblem('a,\n1,2')).toContain('needs a name');
  });

  it('rejects a ragged row and says which', () => {
    expect(findCsvProblem('a,b\n1,2\n3')).toContain('row 3 has 1 fields');
  });

  it('rejects more data rows than the limit', () => {
    const rows = Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) => `${i},x`);
    expect(findCsvProblem(['a,b', ...rows].join('\n'))).toContain('limit');
  });
});
