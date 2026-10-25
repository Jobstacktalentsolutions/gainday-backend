import { z } from 'zod';
import { defineTaskSpec, requireUnique, requireValid } from '../../task-spec';
import { assertCurrency, CENT_TOLERANCE, formatAmount } from '../finance-format';

export const CASH_ACCOUNT = 'Cash at bank';
export const PPE_ACCOUNT = 'Property, plant and equipment';
export const REPAIRS_ACCOUNT = 'Repairs and maintenance expense';

const dataSchema = z.object({
  currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
  transactions: z
    .array(
      z.object({
        description: z.string().describe('Short transaction name, unique within the task.'),
        amount: z.number().positive(),
        treatment: z
          .enum(['CAPITALISE', 'EXPENSE', 'AMBIGUOUS'])
          .describe(
            'CAPITALISE: creates a long-lived asset. EXPENSE: a routine repair or running cost. AMBIGUOUS: a debatable case the candidate must justify in writing; excluded from the answer key. Use exactly one AMBIGUOUS transaction.',
          ),
      }),
    )
    .min(3)
    .max(5),
});

// Capex vs opex with the journal entry (finance doc Section 2.2). Clear-cut transactions are graded
// against one fixed entry each; the single ambiguous one is graded on its written justification.
export const journalEntrySpec = defineTaskSpec(dataSchema, (data) => {
  assertCurrency(data.currency);
  requireUnique(
    data.transactions.map((t) => t.description),
    'transaction descriptions',
  );
  const ambiguousCount = data.transactions.filter(
    (t) => t.treatment === 'AMBIGUOUS',
  ).length;
  requireValid(ambiguousCount === 1, 'exactly one transaction must be AMBIGUOUS');

  const entries = data.transactions
    .filter((t) => t.treatment !== 'AMBIGUOUS')
    .map((t) => {
      const expenseAccount =
        t.treatment === 'CAPITALISE' ? PPE_ACCOUNT : REPAIRS_ACCOUNT;
      return {
        reference: t.description,
        lines: [
          { account: expenseAccount, side: 'DEBIT' as const, amount: t.amount },
          { account: CASH_ACCOUNT, side: 'CREDIT' as const, amount: t.amount },
        ],
      };
    });

  return {
    interfacePayload: {
      table: {
        columns: ['Transaction', `Amount (${data.currency})`],
        rows: data.transactions.map((t) => [
          t.description,
          formatAmount(t.amount, data.currency),
        ]),
      },
      placeholder: null,
    },
    objectiveComponent: {
      accounts: [CASH_ACCOUNT, PPE_ACCOUNT, REPAIRS_ACCOUNT],
      entries,
      tolerance: CENT_TOLERANCE,
      unit: data.currency,
    },
  };
});
