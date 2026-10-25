import { InterfaceType } from '../generation/roles/interface-type';
import { SimulationTask } from '../../db/schema/simulations.schema';
import { RoleRegistry } from '../generation/roles/role-registry';
import { sanitizeTaskForCandidate } from './candidate-task.util';

function financeTask(taskType: string, objectiveComponent: Record<string, unknown>): SimulationTask {
  return {
    id: 't1',
    questionBankId: 'q1',
    taskType,
    category: 'Finance > Reconciliation',
    title: 'Title',
    scenarioDescription: 'Scenario',
    questionPrompt: 'Prompt',
    objectiveComponent,
    businessProblemDerived: false,
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
    interfacePayload: {},
  };
}

describe('sanitizeTaskForCandidate', () => {
  const registry = new RoleRegistry();

  it('removes the reconciliation answer key and tolerance', () => {
    const sanitized = sanitizeTaskForCandidate(
      financeTask('RECONCILIATION_CASH', {
        items: ['Bank charges'],
        sideOptions: [
          { value: 'BANK', label: 'Adjust bank balance' },
          { value: 'BOOK', label: 'Adjust cash ledger' },
        ],
        correctSides: ['BOOK'],
        adjustedBalance: 10000,
        tolerance: 0.01,
        unit: 'USD',
      }),
      registry,
    );
    expect(sanitized.objectiveComponent).toEqual({
      componentType: 'RECONCILIATION',
      items: ['Bank charges'],
      sideOptions: [
        { value: 'BANK', label: 'Adjust bank balance' },
        { value: 'BOOK', label: 'Adjust cash ledger' },
      ],
      unit: 'USD',
    });
  });

  it('shows the journal references and accounts, never the entries', () => {
    const sanitized = sanitizeTaskForCandidate(
      financeTask('JOURNAL_ENTRY_CLASSIFICATION', {
        accounts: ['Cash at bank', 'Repairs and maintenance expense'],
        entries: [
          {
            reference: 'Office window repair',
            lines: [
              { account: 'Cash at bank', side: 'CREDIT', amount: 300 },
              { account: 'Cash at bank', side: 'DEBIT', amount: 300 },
            ],
          },
        ],
        tolerance: 0.01,
        unit: 'USD',
      }),
      registry,
    );
    expect(sanitized.objectiveComponent).toEqual({
      componentType: 'JOURNAL_ENTRY',
      accounts: ['Cash at bank', 'Repairs and maintenance expense'],
      references: ['Office window repair'],
      unit: 'USD',
    });
  });

  it('shows the numeric table labels and drops the correct values', () => {
    const sanitized = sanitizeTaskForCandidate(
      financeTask('BUDGET_VARIANCE', {
        rowLabels: ['Marketing'],
        columns: [{ label: 'Variance (USD)', tolerance: 0.5 }],
        correctValues: [[10]],
      }),
      registry,
    );
    expect(sanitized.objectiveComponent).toEqual({
      componentType: 'NUMERIC_TABLE',
      rowLabels: ['Marketing'],
      columnLabels: ['Variance (USD)'],
    });
  });
});
