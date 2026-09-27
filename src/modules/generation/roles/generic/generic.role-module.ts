import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  RoleModule,
  TaskPatternTypeDefinition,
} from '../role-module.interface';
import { InterfaceType } from '../interface-type';
import { relevanceCheckSchema } from '../../schemas/critic-result.schema';
import { withGeminiSafeStructuredOutput } from '../../../ai/gemini-structured-output.util';

/**
 * Fallback module for any Category that doesn't resolve to a purpose-built role module
 * (see RoleRegistry.resolve). We cannot hand-author a bespoke taxonomy, extraction framing, or
 * presentation layer for every domain a client might post a job in — that's the whole reason
 * role modules exist as isolated, per-role config rather than one shared prompt (doc Section 2).
 * So this module trades content precision for coverage: it never throws, it only ever produces
 * write-in-your-own-words tasks (Text Area / Rich Text Composer — interfaces we already support
 * and can render/grade generically), and instead of hardcoded per-domain guidance strings, its
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
  STAKEHOLDER_PUSHBACK_RESPONSE = 'STAKEHOLDER_PUSHBACK_RESPONSE',
}

// Reuses the exact same open-ended component types (and therefore the exact same
// OPEN_ENDED_COMPONENT_SCHEMAS / INTERFACE_SCHEMAS entries) Finance and Sales already use for
// their write-in-your-own-words tasks — no new schema, no new frontend interface, just a
// narrower slice of the existing taxonomy. No objective components: NUMERIC_INPUT,
// CLASSIFICATION, etc. assume a structured render/grading surface (tables, tolerance ranges)
// that only a purpose-built role module can safely define — never offered here.
const genericTaskPatternTypes: TaskPatternTypeDefinition[] = [
  {
    key: GenericTaskType.WRITTEN_JUSTIFICATION,
    label: 'Written justification',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description:
      'Justify, in writing, a decision or course of action already made in the scenario.',
    interfaceType: InterfaceType.TEXT_AREA,
  },
  {
    key: GenericTaskType.DRAFTED_COMMUNICATION,
    label: 'Drafted communication',
    openEndedComponentType: 'DRAFTED_COMMUNICATION',
    description: 'Draft a message, summary, or deliverable to a stakeholder.',
    interfaceType: InterfaceType.RICH_TEXT_COMPOSER,
  },
  {
    key: GenericTaskType.INTERPRETATION_ANALYSIS,
    label: 'Interpretation / analysis',
    openEndedComponentType: 'INTERPRETATION_ANALYSIS',
    description:
      'Interpret or analyze a described situation or data set, in writing.',
    interfaceType: InterfaceType.TEXT_AREA,
  },
  {
    key: GenericTaskType.STAKEHOLDER_PUSHBACK_RESPONSE,
    label: 'Stakeholder pushback response',
    openEndedComponentType: 'STAKEHOLDER_PUSHBACK_RESPONSE',
    description:
      'Respond, in writing, to a stakeholder raising pushback or an objection.',
    interfaceType: InterfaceType.TEXT_AREA,
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
      'be answerable entirely in writing (prose or short structured text) — never assume a table, ' +
      'calculator, chart, or other structured input surface exists, since none is available for an ' +
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
            `apply to almost any job. Judge strictly: would someone with NO real background in ` +
            `"${extraction.category}" plausibly write a competent-sounding answer to this anyway, ` +
            `just from general common sense? If yes, relevant=false — the task doesn't actually ` +
            `require domain expertise and needs to be regenerated with a more domain-specific angle. ` +
            `If it genuinely requires knowledge or judgment specific to "${extraction.category}" to ` +
            `answer well, relevant=true. List your reasons either way.`,
        ),
        new HumanMessage(JSON.stringify({ extraction, task })),
      ]);

      return result;
    },
  },
};
