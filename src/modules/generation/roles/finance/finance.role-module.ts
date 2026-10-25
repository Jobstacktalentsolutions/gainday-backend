import {
  RoleModule,
  TaskPatternTypeDefinition,
} from '../role-module.interface';
import { InterfaceType } from '../interface-type';
import { RoleCategory } from '../role-category.enum';
import { reconciliationSpec } from './templates/reconciliation.template';
import { journalEntrySpec } from './templates/journal-entry.template';
import { varianceSpec } from './templates/variance.template';
import { forecastSpec } from './templates/forecast.template';
import { statementAnalysisSpec } from './templates/statement-analysis.template';

/** Finance's task-pattern-type keys. Every figure-bearing type is a spec template: the model
 *  supplies raw inputs and code derives the table, chart and answer key (finance doc Section 6.2).
 *  The pushback type carries no figures, so it stays free text. */
export enum FinanceTaskType {
  RECONCILIATION_CASH = 'RECONCILIATION_CASH',
  JOURNAL_ENTRY_CLASSIFICATION = 'JOURNAL_ENTRY_CLASSIFICATION',
  BUDGET_VARIANCE = 'BUDGET_VARIANCE',
  FORECAST_UPDATE = 'FORECAST_UPDATE',
  STATEMENT_ANALYSIS = 'STATEMENT_ANALYSIS',
  STAKEHOLDER_PUSHBACK_RESPONSE = 'STAKEHOLDER_PUSHBACK_RESPONSE',
}

const financeTaskPatternTypes: TaskPatternTypeDefinition[] = [
  {
    key: FinanceTaskType.RECONCILIATION_CASH,
    label: 'Bank reconciliation',
    objectiveComponentType: 'RECONCILIATION',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description:
      'Classify each reconciling item as a bank-side or ledger-side adjustment, compute the adjusted cash balance, and justify the entries that need posting.',
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
    spec: reconciliationSpec,
  },
  {
    key: FinanceTaskType.JOURNAL_ENTRY_CLASSIFICATION,
    label: 'Capex vs opex and journal entries',
    objectiveComponentType: 'JOURNAL_ENTRY',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description:
      'Post a journal entry for each clear-cut transaction, and justify in writing the treatment of one debatable transaction.',
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
    spec: journalEntrySpec,
  },
  {
    key: FinanceTaskType.BUDGET_VARIANCE,
    label: 'Budget variance and explanation',
    objectiveComponentType: 'NUMERIC_TABLE',
    openEndedComponentType: 'INTERPRETATION_ANALYSIS',
    description:
      'Compute the variance and variance percentage for each budget line, then explain the drivers to a non-finance leader.',
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
    spec: varianceSpec,
  },
  {
    key: FinanceTaskType.FORECAST_UPDATE,
    label: 'Forecast update',
    objectiveComponentType: 'NUMERIC_INPUT',
    openEndedComponentType: 'INTERPRETATION_ANALYSIS',
    description:
      'Compute the revised operating result after a price, volume or one-off change, then explain its effect for the decision-maker.',
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
    spec: forecastSpec,
  },
  {
    key: FinanceTaskType.STATEMENT_ANALYSIS,
    label: 'Margin analysis from statements',
    objectiveComponentType: 'NUMERIC_TABLE',
    openEndedComponentType: 'INTERPRETATION_ANALYSIS',
    description:
      'Compute gross and operating margins across periods from a chart and table, then flag what to raise with the CFO.',
    interfaceType: InterfaceType.TABLE_VIEW_WITH_CHART,
    spec: statementAnalysisSpec,
  },
  {
    key: FinanceTaskType.STAKEHOLDER_PUSHBACK_RESPONSE,
    label: 'Stakeholder pushback response',
    openEndedComponentType: 'STAKEHOLDER_PUSHBACK_RESPONSE',
    description:
      'Reply in writing to a stakeholder who challenges a finance decision, without quoting figures.',
    interfaceType: InterfaceType.TEXT_AREA,
  },
];

export const FinanceRoleModule: RoleModule = {
  categoryKeys: [RoleCategory.FINANCE],

  extraction: {
    categorySubDomainGuidance:
      'Finance sub-domains are typically areas like Reconciliation, Financial Reporting, ' +
      'Accounts Payable/Receivable, Budgeting & Forecasting, Audit, or Treasury. Extract the ' +
      'specific sub-domain implied by the job description (e.g. "Finance > Reconciliation"), ' +
      'not just "Finance" alone, when the description supports it.',
    intentFramingGuidance:
      'Finance intent centers on skills like numerical accuracy, procedural rigor, ' +
      'regulatory/policy awareness, and the ability to interpret and communicate financial data.',
    expectedTaskGuidance:
      'Finance is a static, data-based case study: the candidate is given figures in a table, ' +
      'and produces a calculation and/or written analysis. Choose the task type whose inputs the ' +
      'scenario naturally has.',
  },

  allowedTaskPatternTypes: financeTaskPatternTypes,

  criticChecks: {},
};
