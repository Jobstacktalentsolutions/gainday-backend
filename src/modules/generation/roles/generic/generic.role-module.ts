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
 * So this module trades content precision for coverage: it never throws, it only ever produces
 * write-in-your-own-words tasks (Text Area / Rich Text Composer — interfaces we already support
 * and can render/grade generically), optionally reading a small CSV data set (the CSV data panel), and instead of hardcoded per-domain guidance strings, its
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
}

// Reuses the exact same open-ended component types (and therefore the exact same
// OPEN_ENDED_COMPONENT_SCHEMAS / INTERFACE_SCHEMAS entries) Finance and Sales already use for
// their write-in-your-own-words tasks — no new schema, no new frontend interface, just a
// narrower slice of the existing taxonomy, plus the CSV data panel for reading a small data set.
// No objective components: NUMERIC_INPUT, CLASSIFICATION, etc. assume a structured render/grading
// surface (tolerance ranges, bucket rows) that only a purpose-built role module can safely define
// — never offered here.
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
      'Interpret or analyze a situation described in the scenario, in writing. There is no data set here; if the task needs one, it is a DATA_INTERPRETATION task.',
    interfaceType: InterfaceType.TEXT_AREA,
    realities: { maxStimulusWords: 300, defaultDurationMinutes: 8 },
  },
  {
    key: GenericTaskType.DATA_INTERPRETATION,
    label: 'Data interpretation',
    openEndedComponentType: 'INTERPRETATION_ANALYSIS',
    description:
      'A small data set (a log, a report extract, a set of measurements) is given as CSV, shown to the candidate as a table; the candidate interprets it in writing. Only for roles whose real work involves reading data like this.',
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
      'be answerable in writing. The only structured input available is a small CSV data set shown to ' +
      'the candidate as a table (for a role whose real work involves reading data) — never assume a ' +
      'calculator, chart, or any other structured input surface, since none is available for an ' +
      'unmodeled domain like this one. Favor the kind of task where the reasoning in the written ' +
      'answer is itself what reveals competence, since that is what a text response can actually ' +
      'assess well.',
  },

  allowedTaskPatternTypes: genericTaskPatternTypes,

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
          `This task was generated for a domain ("${extraction.category}") with no pre-built ` +
            `assessment template, so it carries a higher risk of generic filler content that could ` +
            `apply to almost any job.\n\n` +
            getSeniorityCriticGuidance(extraction.skillLevel) +
            `\n\nJudge with calibration to the target Seniority / Skill Level above: would someone with NO background ` +
            `in "${extraction.category}" plausibly write a competent answer anyway, just from general common sense? ` +
            `If yes, relevant=false. If it genuinely requires knowledge, fundamentals, or judgment specific to ` +
            `"${extraction.category}" at this seniority level, relevant=true. List your reasons either way.`,
        ),
        new HumanMessage(JSON.stringify({ extraction, task })),
      ]);

      return result as RelevanceCheckResult;
    },
  },
};
