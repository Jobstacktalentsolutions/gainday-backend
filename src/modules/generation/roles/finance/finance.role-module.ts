import {
  RoleModule,
  TaskPatternTypeDefinition,
  makeAnchorCorrectnessCheck,
} from '../role-module.interface';
import { FINANCE_ANCHOR_CORRECTNESS_PROMPT } from './finance.prompts';
import { InterfaceType } from '../interface-type';
import { RoleCategory } from '../role-category.enum';
// TODO(finance-interface-types): doc Section 10 — finance needs dedicated interface types for
// charts/computed figures; none of the 3 current sales-derived types are designed for that.
// Using TABLE_VIEW_RESPONSE_PANEL/TEXT_AREA/RICH_TEXT_COMPOSER as an interim best fit.

/** Finance's task-pattern-type keys, given literal typing here so this module and its call
 *  sites get autocomplete/typo-safety — kept local to finance rather than a shared cross-role
 *  enum, since each role owns and grows its own key set independently (doc Section 2.3). */
export enum FinanceTaskType {
  NUMERIC_INPUT = 'NUMERIC_INPUT',
  CLASSIFICATION = 'CLASSIFICATION',
  PROCEDURAL_SEQUENCING = 'PROCEDURAL_SEQUENCING',
  SINGLE_BEST_ACTION = 'SINGLE_BEST_ACTION',
  MULTI_SELECT_UNDER_CONSTRAINT = 'MULTI_SELECT_UNDER_CONSTRAINT',
  WRITTEN_JUSTIFICATION = 'WRITTEN_JUSTIFICATION',
  DRAFTED_COMMUNICATION = 'DRAFTED_COMMUNICATION',
  INTERPRETATION_ANALYSIS = 'INTERPRETATION_ANALYSIS',
  STAKEHOLDER_PUSHBACK_RESPONSE = 'STAKEHOLDER_PUSHBACK_RESPONSE',
  NUMERIC_INPUT_WITH_JUSTIFICATION = 'NUMERIC_INPUT_WITH_JUSTIFICATION',
}

const financeTaskPatternTypes: TaskPatternTypeDefinition[] = [
  {
    key: FinanceTaskType.NUMERIC_INPUT,
    label: 'Numeric input',
    objectiveComponentType: 'NUMERIC_INPUT',
    description: 'Calculate a value, checked against a tolerance range.',
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
  },
  {
    key: FinanceTaskType.CLASSIFICATION,
    label: 'Classification',
    objectiveComponentType: 'CLASSIFICATION',
    description: 'Sort items into correct buckets.',
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
  },
  {
    key: FinanceTaskType.PROCEDURAL_SEQUENCING,
    label: 'Procedural sequencing',
    objectiveComponentType: 'PROCEDURAL_SEQUENCING',
    description: 'Order steps that have a genuinely correct process order.',
    interfaceType: InterfaceType.TEXT_AREA,
  },
  {
    key: FinanceTaskType.SINGLE_BEST_ACTION,
    label: 'Single-best-action selection',
    objectiveComponentType: 'SINGLE_BEST_ACTION',
    description: 'Pick the one correct action among plausible distractors.',
    interfaceType: InterfaceType.TEXT_AREA,
  },
  {
    key: FinanceTaskType.MULTI_SELECT_UNDER_CONSTRAINT,
    label: 'Multi-select under constraint',
    objectiveComponentType: 'MULTI_SELECT_UNDER_CONSTRAINT',
    description:
      'E.g. "choose 2 of 3," graded against an ideal set membership.',
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
  },
  {
    key: FinanceTaskType.WRITTEN_JUSTIFICATION,
    label: 'Written justification',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description: 'Written justification of a decision already made.',
    interfaceType: InterfaceType.TEXT_AREA,
  },
  {
    key: FinanceTaskType.DRAFTED_COMMUNICATION,
    label: 'Drafted communication',
    openEndedComponentType: 'DRAFTED_COMMUNICATION',
    description: 'Message/summary to a stakeholder.',
    interfaceType: InterfaceType.RICH_TEXT_COMPOSER,
  },
  {
    key: FinanceTaskType.INTERPRETATION_ANALYSIS,
    label: 'Interpretation / analysis',
    openEndedComponentType: 'INTERPRETATION_ANALYSIS',
    description: 'Interpretation/analysis of data.',
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
  },
  {
    key: FinanceTaskType.STAKEHOLDER_PUSHBACK_RESPONSE,
    label: 'Stakeholder pushback response',
    openEndedComponentType: 'STAKEHOLDER_PUSHBACK_RESPONSE',
    description: 'Response to stakeholder pushback.',
    interfaceType: InterfaceType.TEXT_AREA,
  },
  {
    key: FinanceTaskType.NUMERIC_INPUT_WITH_JUSTIFICATION,
    label: 'Numeric input with written justification',
    objectiveComponentType: 'NUMERIC_INPUT',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description:
      'Paired objective + open-ended component, used when the objective answer alone would not reveal whether the candidate understands why it is correct.',
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
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
      'Finance is primarily a static, data/document-based case study: the candidate is given ' +
      'numbers, tables, or a written scenario, and produces a calculation and/or written analysis.',
  },

  allowedTaskPatternTypes: financeTaskPatternTypes,

  anchorCriteriaFraming: {
    problemSolving:
      'Did the candidate correctly identify the financial issue and apply sound quantitative reasoning?',
    judgmentExecution:
      'Did the candidate follow correct financial procedure and execute the calculation/analysis without material error?',
    writtenCommunication:
      'Is the written analysis/communication clear, precise, and appropriately structured for a finance audience?',
    commercialDomainAwareness:
      'Does the response reflect real understanding of financial/commercial implications (e.g. materiality, risk, compliance) rather than mechanical calculation alone?',
  },

  criticChecks: {
    checkAnchorCorrectness: makeAnchorCorrectnessCheck(
      FINANCE_ANCHOR_CORRECTNESS_PROMPT,
    ),
  },
};
