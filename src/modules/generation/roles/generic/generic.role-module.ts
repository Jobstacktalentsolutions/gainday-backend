import { getSeniorityCriticGuidance } from '../../task-text-rules';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  RelevanceCheckResult,
  RoleModule,
  TaskPatternTypeDefinition,
} from '../role-module.interface';
import { InterfaceType } from '../interface-type';
import { relevanceCheckSchema } from '../../schemas/critic-result.schema';
import { withGeminiSafeStructuredOutput } from '../../../ai/gemini-structured-output.util';

/**
 * Universal fallback module used when an employer enters a job title/category we have no
 * purpose-built role module for (e.g. Legal Counsel, Data Scientist, Marketing Ops, Product
 * Manager, Nurse, Graphic Designer, Executive Assistant, etc. — any unmodeled profession).
 *
 * This module trades content precision for coverage: it produces written-response tasks with
 * optional tables or case files. Instead of hardcoded per-domain guidance strings, its
 * extraction/generation prompts explicitly instruct the model to *reason out* what a genuine
 * on-the-job assessment for THIS specific unseen category should look like, using its own general
 * domain knowledge, rather than forcing the category into Finance/Sales-shaped content.
 *
 * Deliberately unregistered under any categoryKeys — RoleRegistry falls back to this instance
 * itself when no registered module matches, rather than this module claiming a key up front.
 */

export enum GenericTaskType {
  WRITTEN_JUSTIFICATION = 'WRITTEN_JUSTIFICATION',
  DRAFTED_COMMUNICATION = 'DRAFTED_COMMUNICATION',
  INTERPRETATION_ANALYSIS = 'INTERPRETATION_ANALYSIS',
  DATA_INTERPRETATION = 'DATA_INTERPRETATION',
  STAKEHOLDER_PUSHBACK_RESPONSE = 'STAKEHOLDER_PUSHBACK_RESPONSE',
  CLASSIFY_ITEMS = 'GENERIC_CLASSIFY_ITEMS',
  PRIORITIZE_ITEMS = 'GENERIC_PRIORITIZE_ITEMS',
  SEQUENCE_STEPS = 'GENERIC_SEQUENCE_STEPS',
  CHOOSE_ACTION = 'GENERIC_CHOOSE_ACTION',
  SELECT_ACTIONS = 'GENERIC_SELECT_ACTIONS',
}

// Reuses the exact same open-ended component types (and therefore the exact same
// OPEN_ENDED_COMPONENT_SCHEMAS / INTERFACE_SCHEMAS entries) Finance and Sales already use for
// their write-in-your-own-words tasks — no new schema, no new frontend interface, just a
// narrower slice of the existing taxonomy, with several ways to present supporting information.
// Quantitative answer keys stay in spec-backed modules where code derives the correct values.
const genericTaskPatternTypes: TaskPatternTypeDefinition[] = [
  {
    key: GenericTaskType.WRITTEN_JUSTIFICATION,
    label: 'Written justification',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description:
      'Justify, in writing, a decision or course of action already made in the scenario.',
    interfaceType: InterfaceType.TEXT_AREA,
    realities: { maxStimulusWords: 250, defaultDurationMinutes: 7 },
  },
  {
    key: GenericTaskType.DRAFTED_COMMUNICATION,
    label: 'Drafted communication',
    openEndedComponentType: 'DRAFTED_COMMUNICATION',
    description: 'Draft a message, summary, or deliverable to a stakeholder.',
    interfaceType: InterfaceType.RICH_TEXT_COMPOSER,
    realities: { maxStimulusWords: 250, defaultDurationMinutes: 7 },
  },
  {
    key: GenericTaskType.INTERPRETATION_ANALYSIS,
    label: 'Interpretation / analysis',
    openEndedComponentType: 'INTERPRETATION_ANALYSIS',
    description:
      'Interpret or analyze a situation and supporting evidence in writing.',
    interfaceType: InterfaceType.TEXT_AREA,
    realities: { maxStimulusWords: 300, defaultDurationMinutes: 8 },
  },
  {
    key: GenericTaskType.DATA_INTERPRETATION,
    label: 'Data interpretation',
    openEndedComponentType: 'INTERPRETATION_ANALYSIS',
    description:
      'Interpret a small data set, such as a log, report extract or set of measurements, in writing. Only for roles whose work involves reading such data.',
    interfaceType: InterfaceType.CSV_DATA_PANEL,
    realities: { maxStimulusWords: 300, defaultDurationMinutes: 9 },
  },
  {
    key: GenericTaskType.STAKEHOLDER_PUSHBACK_RESPONSE,
    label: 'Stakeholder pushback response',
    openEndedComponentType: 'STAKEHOLDER_PUSHBACK_RESPONSE',
    description:
      'Respond, in writing, to a stakeholder raising pushback or an objection.',
    interfaceType: InterfaceType.TEXT_AREA,
    realities: { maxStimulusWords: 200, defaultDurationMinutes: 6 },
  },
  {
    key: GenericTaskType.CLASSIFY_ITEMS,
    label: 'Classify items',
    objectiveComponentType: 'CLASSIFICATION',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description: 'Group distinct role-specific items into meaningful categories, then justify the choices. Provide enough evidence for the classifications.',
    interfaceType: InterfaceType.TEXT_AREA,
    realities: { maxStimulusWords: 250, defaultDurationMinutes: 8 },
  },
  {
    key: GenericTaskType.PRIORITIZE_ITEMS,
    label: 'Prioritize items',
    objectiveComponentType: 'PRIORITY_RANKING',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description: 'Rank distinct role-specific requests or actions by priority and explain the top choice. Include clear signals such as impact and urgency.',
    interfaceType: InterfaceType.TEXT_AREA,
    realities: { maxStimulusWords: 250, defaultDurationMinutes: 7 },
  },
  {
    key: GenericTaskType.SEQUENCE_STEPS,
    label: 'Sequence steps',
    objectiveComponentType: 'PROCEDURAL_SEQUENCING',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description: 'Arrange shuffled steps of a role-specific procedure into the correct order and explain a key dependency.',
    interfaceType: InterfaceType.TEXT_AREA,
    realities: { maxStimulusWords: 250, defaultDurationMinutes: 7 },
  },
  {
    key: GenericTaskType.CHOOSE_ACTION,
    label: 'Choose an action',
    objectiveComponentType: 'SINGLE_BEST_ACTION',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description: 'Choose the best action in a role-specific situation and explain the decision. Give one clearly defensible best option.',
    interfaceType: InterfaceType.TEXT_AREA,
    realities: { maxStimulusWords: 250, defaultDurationMinutes: 6 },
  },
  {
    key: GenericTaskType.SELECT_ACTIONS,
    label: 'Select actions',
    objectiveComponentType: 'MULTI_SELECT_UNDER_CONSTRAINT',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description: 'Select a fixed number of appropriate actions from distinct alternatives and explain the choices. Make the correct set unambiguous from the evidence.',
    interfaceType: InterfaceType.TEXT_AREA,
    realities: { maxStimulusWords: 250, defaultDurationMinutes: 7 },
  },
];

const genericInterfaces: [InterfaceType, ...InterfaceType[]] = [
  InterfaceType.TEXT_AREA,
  InterfaceType.RICH_TEXT_COMPOSER,
  InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
  InterfaceType.CSV_DATA_PANEL,
  InterfaceType.CASE_FILE_TEXT_AREA,
  InterfaceType.TABLE_VIEW_WITH_CHART,
];
const interactionInterfaces: [InterfaceType, ...InterfaceType[]] = [
  InterfaceType.TEXT_AREA,
  InterfaceType.CASE_FILE_TEXT_AREA,
  InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
];

export const GenericRoleModule: RoleModule = {
  categoryKeys: [],

  extraction: {
    categorySubDomainGuidance:
      'This category does not match one of our pre-built domain modules. Still extract a ' +
      'specific, meaningful sub-domain from the description (e.g. "Customer Support > Technical ' +
      'Troubleshooting", not just "Customer Support" alone) — specificity here is what lets task ' +
      'generation later target something real instead of a generic exercise.',
    intentFramingGuidance:
      'There is no pre-defined competency framework for this domain. Reason from your own general ' +
      'and industry-specific knowledge about what a genuinely competent person in THIS exact role ' +
      'would need to demonstrate day-to-day — the specific judgment calls, domain knowledge, and ' +
      'communication demands that separate a strong performer from a weak one in this field. Frame ' +
      'Intent around those concrete competencies, not generic soft skills like "communication" or ' +
      '"teamwork" that could describe any job.',
    expectedTaskGuidance:
      'Since this role has no pre-built task template, invent the kind of on-the-job situation a ' +
      'real practitioner in this exact domain would actually face — a written deliverable, a ' +
      'judgment call they must explain, or an analysis they must produce. Every expected task must ' +
      'be answerable in writing. Input can include a small table, CSV data set, or a case file with ' +
      'reference tabs, or a chart with a table, where appropriate. Do not assume a calculator. Favor tasks where the written ' +
      'answer is itself what reveals competence, since that is what a text response can actually ' +
      'assess well.',
  },

  allowedTaskPatternTypes: genericTaskPatternTypes.map((pattern) => ({
    ...pattern,
    allowedInterfaceTypes: pattern.objectiveComponentType
      ? interactionInterfaces
      : genericInterfaces,
    validateInteraction: !!pattern.objectiveComponentType,
    gradeInteractionWithModel: pattern.key === GenericTaskType.SELECT_ACTIONS,
  })),

  criticChecks: {
    // Un-curated domains carry more risk of vague, could-be-any-job filler than a hand-tuned
    // module — this is an extra relevance bar on top of the generic Category/Intent check,
    // asking the judge model to reject content that doesn't clearly require domain expertise.
    additionalRelevanceCheck: async (task, extraction, criticModel) => {
      const model = withGeminiSafeStructuredOutput(
        criticModel,
        relevanceCheckSchema,
      );

      const result = await model.invoke([
        new SystemMessage(
          `This task is for domain "${extraction.category}" (no pre-built template; guard against generic filler).\n\n` +
            getSeniorityCriticGuidance(extraction.skillLevel) +
            `\n\nJudge strictly against the target seniority above: would someone with NO background in "${extraction.category}" write a competent answer using only general common sense? If yes, relevant=false. If it requires domain knowledge, fundamentals, or judgment specific to "${extraction.category}", relevant=true.`,
        ),
        new HumanMessage(JSON.stringify({ extraction, task })),
      ]);

      return result as RelevanceCheckResult;
    },
  },
};
