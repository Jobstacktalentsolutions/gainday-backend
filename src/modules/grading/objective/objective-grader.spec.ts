import { gradeObjective, isDeterministic } from './objective-grader';

describe('gradeObjective', () => {
  describe('NUMERIC_INPUT', () => {
    const component = { correctValue: 5500, tolerance: 0.5, unit: 'USD' };

    it('awards the full score within tolerance', () => {
      expect(gradeObjective('NUMERIC_INPUT', component, 5500.4)).toEqual({
        score: 100,
        correctParts: 1,
        totalParts: 1,
      });
    });

    it('awards nothing outside tolerance or when unanswered', () => {
      expect(gradeObjective('NUMERIC_INPUT', component, 5600)?.score).toBe(0);
      expect(gradeObjective('NUMERIC_INPUT', component, null)?.score).toBe(0);
    });
  });

  describe('RECONCILIATION', () => {
    const component = {
      items: ['Deposit in transit', 'Bank charges'],
      sideOptions: [
        { value: 'BANK', label: 'Adjust bank balance' },
        { value: 'BOOK', label: 'Adjust cash ledger' },
      ],
      correctSides: ['BANK', 'BOOK'],
      adjustedBalance: 10000,
      tolerance: 0.01,
      unit: 'USD',
    };

    it('gives partial credit per item, with the balance as one more part', () => {
      const result = gradeObjective('RECONCILIATION', component, {
        sides: ['BANK', 'BANK'],
        adjustedBalance: 10000,
      });
      // one of two sides right, balance right: 2 of 3 parts
      expect(result).toEqual({ score: 67, correctParts: 2, totalParts: 3 });
    });

    it('scores zero when the candidate left the part untouched', () => {
      expect(gradeObjective('RECONCILIATION', component, null)?.correctParts).toBe(0);
    });
  });

  describe('JOURNAL_ENTRY', () => {
    const component = {
      accounts: ['Cash at bank', 'Repairs and maintenance expense'],
      entries: [
        {
          reference: 'Office window repair',
          lines: [
            { account: 'Repairs and maintenance expense', side: 'DEBIT', amount: 300 },
            { account: 'Cash at bank', side: 'CREDIT', amount: 300 },
          ],
        },
        {
          reference: 'Kitchen refit',
          lines: [
            { account: 'Repairs and maintenance expense', side: 'DEBIT', amount: 900 },
            { account: 'Cash at bank', side: 'CREDIT', amount: 900 },
          ],
        },
      ],
      tolerance: 0.01,
      unit: 'USD',
    };

    it('credits an entry only when its lines match the key exactly', () => {
      const result = gradeObjective('JOURNAL_ENTRY', component, {
        lines: [
          { reference: 'Office window repair', account: 'Repairs and maintenance expense', side: 'DEBIT', amount: 300 },
          { reference: 'Office window repair', account: 'Cash at bank', side: 'CREDIT', amount: 300 },
          { reference: 'Kitchen refit', account: 'Repairs and maintenance expense', side: 'CREDIT', amount: 900 },
          { reference: 'Kitchen refit', account: 'Cash at bank', side: 'DEBIT', amount: 900 },
        ],
      });
      expect(result).toEqual({ score: 50, correctParts: 1, totalParts: 2 });
    });

    it('ignores lines for references the key does not contain', () => {
      const result = gradeObjective('JOURNAL_ENTRY', component, {
        lines: [
          { reference: 'Office window repair', account: 'Repairs and maintenance expense', side: 'DEBIT', amount: 300 },
          { reference: 'Office window repair', account: 'Cash at bank', side: 'CREDIT', amount: 300 },
          { reference: 'Kitchen refit', account: 'Repairs and maintenance expense', side: 'DEBIT', amount: 900 },
          { reference: 'Kitchen refit', account: 'Cash at bank', side: 'CREDIT', amount: 900 },
          { reference: 'Warehouse extension', account: 'Cash at bank', side: 'CREDIT', amount: 1 },
        ],
      });
      expect(result?.score).toBe(100);
    });
  });

  describe('NUMERIC_TABLE', () => {
    const component = {
      rowLabels: ['Marketing', 'Travel'],
      columns: [
        { label: 'Variance (USD)', tolerance: 0.5 },
        { label: 'Variance (%)', tolerance: 0.05 },
      ],
      correctValues: [
        [10, 10],
        [-50, -25],
      ],
    };

    it('grades cell by cell, each column against its own tolerance', () => {
      const result = gradeObjective('NUMERIC_TABLE', component, {
        values: [
          [10.2, 10.04],
          [-50, -24.9],
        ],
      });
      // Marketing right in both cells; Travel right in the amount, wrong in the percentage
      expect(result).toEqual({ score: 75, correctParts: 3, totalParts: 4 });
    });
  });

  it('returns null for component types without an answer key, so the LLM grades them', () => {
    expect(isDeterministic('CLASSIFICATION')).toBe(false);
    expect(gradeObjective('CLASSIFICATION', { items: [], buckets: [] }, null)).toBeNull();
  });
});
