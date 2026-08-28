import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  AnchorCorrectnessResult,
  GeneratedTaskCandidate,
  RoleModule,
  TaskPatternTypeDefinition,
} from '../role-module.interface';
import { FINANCE_ANCHOR_CORRECTNESS_PROMPT } from './finance.prompts';

const anchorCorrectnessSchema = z.object({
  sound: z.boolean(),
  reasons: z.array(z.string()),
});

const financeTaskPatternTypes: TaskPatternTypeDefinition[] = [
  {
    key: 'NUMERIC_INPUT',
    label: 'Numeric input',
    objectiveComponentType: 'NUMERIC_INPUT',
    description: 'Calculate a value, checked against a tolerance range.',
  },
  {
    key: 'CLASSIFICATION',
    label: 'Classification',
    objectiveComponentType: 'CLASSIFICATION',
    description: 'Sort items into correct buckets.',
  },
  {
    key: 'PROCEDURAL_SEQUENCING',
    label: 'Procedural sequencing',
    objectiveComponentType: 'PROCEDURAL_SEQUENCING',
    description: 'Order steps that have a genuinely correct process order.',
  },
  {
    key: 'SINGLE_BEST_ACTION',
    label: 'Single-best-action selection',
    objectiveComponentType: 'SINGLE_BEST_ACTION',
    description: 'Pick the one correct action among plausible distractors.',
  },
  {
    key: 'MULTI_SELECT_UNDER_CONSTRAINT',
    label: 'Multi-select under constraint',
    objectiveComponentType: 'MULTI_SELECT_UNDER_CONSTRAINT',
    description:
      'E.g. "choose 2 of 3," graded against an ideal set membership.',
  },
  {
    key: 'WRITTEN_JUSTIFICATION',
    label: 'Written justification',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description: 'Written justification of a decision already made.',
  },
  {
    key: 'DRAFTED_COMMUNICATION',
    label: 'Drafted communication',
    openEndedComponentType: 'DRAFTED_COMMUNICATION',
    description: 'Message/summary to a stakeholder.',
  },
  {
    key: 'INTERPRETATION_ANALYSIS',
    label: 'Interpretation / analysis',
    openEndedComponentType: 'INTERPRETATION_ANALYSIS',
    description: 'Interpretation/analysis of data.',
  },
  {
    key: 'STAKEHOLDER_PUSHBACK_RESPONSE',
    label: 'Stakeholder pushback response',
    openEndedComponentType: 'STAKEHOLDER_PUSHBACK_RESPONSE',
    description: 'Response to stakeholder pushback.',
  },
  {
    key: 'NUMERIC_INPUT_WITH_JUSTIFICATION',
    label: 'Numeric input with written justification',
    objectiveComponentType: 'NUMERIC_INPUT',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description:
      'Paired objective + open-ended component, used when the objective answer alone would not reveal whether the candidate understands why it is correct.',
  },
];

export const FinanceRoleModule: RoleModule = {
  categoryKeys: ['Finance'],

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
    async checkAnchorCorrectness(
      task: GeneratedTaskCandidate,
      criticModel,
    ): Promise<AnchorCorrectnessResult> {
      const structuredModel = criticModel.withStructuredOutput<
        z.infer<typeof anchorCorrectnessSchema>
      >(anchorCorrectnessSchema);
      const result = await structuredModel.invoke([
        new SystemMessage(FINANCE_ANCHOR_CORRECTNESS_PROMPT),
        new HumanMessage(
          JSON.stringify({
            taskContent: task.taskContent,
            anchors: task.anchors,
          }),
        ),
      ]);
      return result;
    },
  },

  presentationSpec: {
    rendererHint: 'finance-tabular',
    notes:
      'Numeric/tabular data must render in a way a finance-literate candidate can actually work ' +
      'with: tables, figures, and clearly formatted numbers — not plain prose paragraphs.',
  },
};
