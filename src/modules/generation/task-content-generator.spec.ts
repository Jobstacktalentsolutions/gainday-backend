import { revisionClause } from './task-content-generator';

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
