import { z } from 'zod';
import { defineTaskSpec, requireUnique, requireValid } from '../../task-spec';
import {
  assertCurrency,
  CENT_TOLERANCE,
  formatAmount,
  roundTo,
} from '../finance-format';

// Where each kind of item sits in a bank reconciliation (finance doc Section 2.1). The answer key
// records a side per item from this table, so the candidate's classification is checked against
// the textbook rule rather than a judgment call.
const ITEM_KINDS = [
  'DEPOSIT_IN_TRANSIT',
  'OUTSTANDING_CHEQUE',
  'BANK_CHARGE',
  'BANK_INTEREST',
  'NSF_CHEQUE',
  'BANK_COLLECTION',
] as const;
type ItemKind = (typeof ITEM_KINDS)[number];

const BANK_SIDE_KINDS: ReadonlySet<ItemKind> = new Set<ItemKind>([
  'DEPOSIT_IN_TRANSIT',
  'OUTSTANDING_CHEQUE',
]);

const SIDE_OPTIONS = [
  { value: 'BANK', label: 'Adjust bank balance' },
  { value: 'BOOK', label: 'Adjust cash ledger' },
];

const dataSchema = z.object({
  currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
  periodEnd: z
    .string()
    .describe('Period-end date as the scenario states it, e.g. "31 March 2027".'),
  adjustedBalance: z
    .number()
    .positive()
    .describe(
      'The true reconciled cash balance. The bank and ledger balances are derived from it.',
    ),
  items: z
    .array(
      z.object({
        description: z.string().describe('Short line-item name, unique within the task.'),
        kind: z
          .enum(ITEM_KINDS)
          .describe(
            'DEPOSIT_IN_TRANSIT: in the ledger, not yet credited by the bank. OUTSTANDING_CHEQUE: issued, not yet presented to the bank. BANK_CHARGE, BANK_INTEREST, NSF_CHEQUE and BANK_COLLECTION: recorded by the bank, not yet in the ledger.',
          ),
        amount: z.number().positive(),
      }),
    )
    .min(3)
    .max(6),
});

export const reconciliationSpec = defineTaskSpec(dataSchema, (data) => {
  assertCurrency(data.currency);
  requireUnique(
    data.items.map((item) => item.description),
    'reconciling item descriptions',
  );

  const totalOf = (kind: ItemKind) =>
    data.items
      .filter((item) => item.kind === kind)
      .reduce((total, item) => total + item.amount, 0);

  // adjusted = bank + deposits in transit − outstanding cheques
  //          = ledger + interest + collections − charges − NSF cheques
  // Solving backwards from the adjusted balance makes both reconciliations exact by construction.
  const bankBalance = roundTo(
    data.adjustedBalance - totalOf('DEPOSIT_IN_TRANSIT') + totalOf('OUTSTANDING_CHEQUE'),
    2,
  );
  const ledgerBalance = roundTo(
    data.adjustedBalance -
      totalOf('BANK_INTEREST') -
      totalOf('BANK_COLLECTION') +
      totalOf('BANK_CHARGE') +
      totalOf('NSF_CHEQUE'),
    2,
  );
  requireValid(bankBalance > 0, 'the bank balance would not be positive');
  requireValid(ledgerBalance > 0, 'the cash ledger balance would not be positive');

  const money = (value: number) => formatAmount(value, data.currency);
  return {
    interfacePayload: {
      table: {
        columns: ['Item', `Amount (${data.currency}) at ${data.periodEnd}`],
        rows: [
          ['Balance per bank statement', money(bankBalance)],
          ['Balance per cash ledger', money(ledgerBalance)],
          ...data.items.map((item) => [item.description, money(item.amount)]),
        ],
      },
      placeholder: null,
    },
    objectiveComponent: {
      items: data.items.map((item) => item.description),
      sideOptions: SIDE_OPTIONS,
      correctSides: data.items.map((item) =>
        BANK_SIDE_KINDS.has(item.kind) ? 'BANK' : 'BOOK',
      ),
      adjustedBalance: data.adjustedBalance,
      tolerance: CENT_TOLERANCE,
      unit: data.currency,
    },
  };
});
