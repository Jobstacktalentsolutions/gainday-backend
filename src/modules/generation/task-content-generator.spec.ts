import { revisionClause, stripTextWordLimits } from './task-content-generator';

describe('revisionClause', () => {
  it('is empty when there is no rejected attempt', () => {
    expect(revisionClause(undefined)).toBe('');
    expect(revisionClause([])).toBe('');
  });

  it('names every reason from the rejected attempt', () => {
    const clause = revisionClause(['The text states figures the table does not show (10).', 'Relevance failed.']);
    expect(clause).toContain('The previous attempt was rejected');
    expect(clause).toContain('figures the table does not show (10).');
    expect(clause).toContain('Relevance failed.');
  });
});

describe('stripTextWordLimits', () => {
  it('handles null/undefined/empty input', () => {
    expect(stripTextWordLimits(null)).toBe('');
    expect(stripTextWordLimits(undefined)).toBe('');
    expect(stripTextWordLimits('')).toBe('');
  });

  it('strips "keep the document under 300 words" style phrases', () => {
    const input =
      "Address the handoff to the designated recipient and keep the document under 300 words.";
    expect(stripTextWordLimits(input)).toBe(
      'Address the handoff to the designated recipient.',
    );
  });

  it('strips "Limit the note to 200 words." style phrases', () => {
    const input =
      'Include the SLA deadline, and a clear request for root-cause analysis. Limit the note to 200 words.';
    expect(stripTextWordLimits(input)).toBe(
      'Include the SLA deadline, and a clear request for root-cause analysis.',
    );
  });

  it('strips parenthesized limit statements', () => {
    const input = 'Write a concise justification (under 100 words).';
    expect(stripTextWordLimits(input)).toBe('Write a concise justification.');
  });

  it('leaves clean text untouched', () => {
    const input = 'Draft a clear and structured handoff email to the billing team.';
    expect(stripTextWordLimits(input)).toBe(input);
  });
});
