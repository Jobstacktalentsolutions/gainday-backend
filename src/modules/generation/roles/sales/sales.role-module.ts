import {
  RoleModule,
  TaskPatternTypeDefinition,
} from '../role-module.interface';
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
  INBOX_PRIORITIZATION = 'INBOX_PRIORITIZATION',
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
      'candidate sorts the leads into priority buckets on the table itself and justifies their ' +
      'choices. The underlying data must make some placements clearly better than others — not ' +
      'an ambiguous set where any bucketing is defensible (this is what keeps it from becoming ' +
      'an excluded pure-ranking mechanic). Keep it to roughly 6-8 leads, and ask the candidate to ' +
      'justify only their highest-priority picks so the answer fits a short written response.',
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
  {
    key: SalesTaskType.INBOX_PRIORITIZATION,
    label: 'Inbox / workload prioritization',
    objectiveComponentType: 'PRIORITY_RANKING',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description:
      'Candidate receives several competing messages or requests (e.g. a morning inbox) and ranks ' +
      'them from highest to lowest priority, then explains their top choice. The items must carry ' +
      'enough signal (deadlines, revenue at risk, stakeholder seniority) that some orderings are ' +
      'clearly better than others — the written reasoning is what gets graded, not the order alone.',
    interfaceType: InterfaceType.TEXT_AREA,
  },
];

export const SalesRoleModule: RoleModule = {
  categoryKeys: [RoleCategory.SALES],

  extraction: {
    categorySubDomainGuidance:
      'Sales sub-domains map to sub-roles — SDR/BDR (prospecting-focused), AE (closing-focused), ' +
      'or CSM/Account Manager (retention, renewal and account management; customer retention roles route here) — extract the specific sub-role implied by the ' +
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

  criticChecks: {},
};
