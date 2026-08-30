import {
  RoleModule,
  TaskPatternTypeDefinition,
  makeAnchorCorrectnessCheck,
} from '../role-module.interface';
import { SALES_ANCHOR_CORRECTNESS_PROMPT } from './sales.prompts';
import { InterfaceType } from '../interface-type';
import { RoleCategory } from '../role-category.enum';

/** Sales's task-pattern-type keys, given literal typing here so this module and its call
 *  sites get autocomplete/typo-safety — kept local to sales rather than a shared cross-role
 *  enum, since each role owns and grows its own key set independently (doc Section 2.3). */
export enum SalesTaskType {
  COLD_OUTREACH_EMAIL = 'COLD_OUTREACH_EMAIL',
  OBJECTION_HANDLING_WRITTEN = 'OBJECTION_HANDLING_WRITTEN',
  PIPELINE_PRIORITIZATION = 'PIPELINE_PRIORITIZATION',
  CLOSING_NEGOTIATION_SITUATIONAL = 'CLOSING_NEGOTIATION_SITUATIONAL',
  ACCOUNT_PLANNING = 'ACCOUNT_PLANNING',
}

/**
 * MVP scope: all 5 text-native categories from the companion Sales doc (Section 5's
 * recommended scope; "build first" vs. "defer" was a validation-sequencing suggestion, not
 * an architectural constraint — building all 5 now since they're equally text-native).
 * Section 3's conversational categories (live cold-call/discovery/negotiation roleplay) are
 * explicitly out of scope — they need a different, multi-turn generation/grading architecture
 * and a chat/message-thread interface type that doesn't exist yet.
 */
const salesTaskPatternTypes: TaskPatternTypeDefinition[] = [
  {
    key: SalesTaskType.COLD_OUTREACH_EMAIL,
    label: 'Cold outreach / prospecting email',
    openEndedComponentType: 'DRAFTED_COMMUNICATION',
    description:
      'Candidate is given a target company/persona profile and product context, and writes a ' +
      'cold outreach email pitching the product.',
    interfaceType: InterfaceType.RICH_TEXT_COMPOSER,
  },
  {
    key: SalesTaskType.OBJECTION_HANDLING_WRITTEN,
    label: 'Objection handling (written response)',
    openEndedComponentType: 'STAKEHOLDER_PUSHBACK_RESPONSE',
    description:
      'A specific objection (price, competitor, timing, skepticism) is presented as a message ' +
      'from a persona; candidate drafts a written reply.',
    interfaceType: InterfaceType.TEXT_AREA,
  },
  {
    key: SalesTaskType.PIPELINE_PRIORITIZATION,
    label: 'Pipeline / lead prioritization',
    objectiveComponentType: 'CLASSIFICATION',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description:
      'A mock CRM lead list (deal stage, last contact, deal size, urgency signals) is given; ' +
      'candidate prioritizes the leads and justifies the order. The underlying data must make ' +
      'some orderings clearly better than others — not an ambiguous set where any order is ' +
      'defensible (this is what keeps it from becoming an excluded pure-ranking mechanic).',
    interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
  },
  {
    key: SalesTaskType.CLOSING_NEGOTIATION_SITUATIONAL,
    label: 'Closing / negotiation situational judgment',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description:
      'A hypothetical mid-negotiation situation (e.g. a late discount request, a prospect who ' +
      'goes quiet) is described as narrative context; candidate describes how they would respond.',
    interfaceType: InterfaceType.TEXT_AREA,
  },
  {
    key: SalesTaskType.ACCOUNT_PLANNING,
    label: 'Account planning / strategic prioritization',
    openEndedComponentType: 'INTERPRETATION_ANALYSIS',
    description:
      'Candidate is given information about a named target account and asked to produce a plan: ' +
      'stakeholders, approach sequencing, and strategy. Most senior/AE-oriented category.',
    interfaceType: InterfaceType.RICH_TEXT_COMPOSER,
  },
];

export const SalesRoleModule: RoleModule = {
  categoryKeys: [RoleCategory.SALES],

  extraction: {
    categorySubDomainGuidance:
      'Sales sub-domains map to sub-roles — SDR/BDR (prospecting-focused), AE (closing-focused), ' +
      'or CSM/Account Manager (retention-focused) — extract the specific sub-role implied by the ' +
      'job description (e.g. "Sales > SDR") when the description supports it, not just "Sales" alone.',
    intentFramingGuidance:
      'Sales intent centers on skills like prospecting and outreach effectiveness, objection ' +
      'handling, deal/pipeline judgment, negotiation and deal-value protection, and stakeholder ' +
      'awareness — which of these matters most depends on the sub-role (SDR vs. AE vs. CSM).',
    expectedTaskGuidance:
      'Sales is primarily conversational/situational rather than static/data-based: the candidate ' +
      'reacts to a persona, an objection, or a live situation. Restrict expected tasks to the ' +
      'text-native forms this module supports — a written deliverable, a single written response ' +
      'to described context, or a data table plus written response — never a live, multi-turn ' +
      'conversational exercise.',
  },

  allowedTaskPatternTypes: salesTaskPatternTypes,

  anchorCriteriaFraming: {
    problemSolving:
      'Did the candidate correctly read the sales situation (e.g. which lever actually matters — ' +
      'deal size vs. urgency vs. probability to close; stalling vs. genuine hesitation) and apply ' +
      'sound sales reasoning rather than a generic playbook response?',
    judgmentExecution:
      'Did the candidate make the right sales judgment call — e.g. acknowledging an objection ' +
      'before countering it, protecting deal value instead of defaulting to a discount, choosing ' +
      'a single clear call-to-action or next step rather than a vague one?',
    writtenCommunication:
      'Is the written email/message/plan clear, appropriately concise, and free of generic ' +
      'mass-outreach or reassurance-language tells that a real buyer would recognize and discount?',
    commercialDomainAwareness:
      'Does the response reflect real understanding of the buyer/deal context — speaking to a ' +
      'specific pain point rather than product features, correctly identifying stakeholder roles, ' +
      'or reasoning about deal economics — rather than a generic, could-apply-to-any-deal answer?',
  },

  criticChecks: {
    checkAnchorCorrectness: makeAnchorCorrectnessCheck(
      SALES_ANCHOR_CORRECTNESS_PROMPT,
    ),
  },
};
