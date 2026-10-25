import {
  GeneratedTaskCandidate,
  RoleModule,
  TaskPatternTypeDefinition,
} from '../role-module.interface';
import { InterfaceType } from '../interface-type';
import { RoleCategory } from '../role-category.enum';
import { unsourcedFigures } from '../narrative-figures';
import { refundPolicyReplySpec } from './templates/refund-policy-reply.template';
import { deEscalationReplySpec } from './templates/de-escalation-reply.template';
import { improperRequestReplySpec } from './templates/improper-request-reply.template';
import { diagnosticQuestionsSpec } from './templates/diagnostic-questions.template';
import { escalationHandoffSpec } from './templates/escalation-handoff.template';
import { ticketTriageSpec } from './templates/ticket-triage.template';

/** Customer service task-pattern keys (customer service doc Section 2). Every task is spec-backed: the
 *  model supplies the scenario inputs, and code derives the case file, the rubric and any answer key. */
export enum CustomerServiceTaskType {
  REFUND_POLICY_REPLY = 'REFUND_POLICY_REPLY',
  DE_ESCALATION_REPLY = 'DE_ESCALATION_REPLY',
  IMPROPER_REQUEST_REPLY = 'IMPROPER_REQUEST_REPLY',
  DIAGNOSTIC_QUESTIONS = 'DIAGNOSTIC_QUESTIONS',
  ESCALATION_HANDOFF = 'ESCALATION_HANDOFF',
  TICKET_TRIAGE = 'TICKET_TRIAGE',
}

const customerServiceTaskPatternTypes: TaskPatternTypeDefinition[] = [
  {
    key: CustomerServiceTaskType.REFUND_POLICY_REPLY,
    label: 'Policy-bound ticket reply',
    openEndedComponentType: 'DRAFTED_COMMUNICATION',
    description:
      'Reply to a customer whose request depends on applying a refund policy, with an authorised alternative where the policy allows one.',
    interfaceType: InterfaceType.CASE_FILE_TEXT_AREA,
    spec: refundPolicyReplySpec,
  },
  {
    key: CustomerServiceTaskType.DE_ESCALATION_REPLY,
    label: 'De-escalation and boundary-setting',
    openEndedComponentType: 'DRAFTED_COMMUNICATION',
    description:
      'Reply to an angry or abusive customer who threatens a review, a chargeback or a safety risk, without mirroring their tone.',
    interfaceType: InterfaceType.CASE_FILE_TEXT_AREA,
    spec: deEscalationReplySpec,
  },
  {
    key: CustomerServiceTaskType.IMPROPER_REQUEST_REPLY,
    label: 'Improper request (compliance gate)',
    openEndedComponentType: 'DRAFTED_COMMUNICATION',
    description:
      'Decline a request that must not be granted without the required step, and offer the legitimate path.',
    interfaceType: InterfaceType.CASE_FILE_TEXT_AREA,
    spec: improperRequestReplySpec,
  },
  {
    key: CustomerServiceTaskType.DIAGNOSTIC_QUESTIONS,
    label: 'Diagnostic questioning',
    objectiveComponentType: 'MULTI_SELECT_UNDER_CONSTRAINT',
    openEndedComponentType: 'DRAFTED_COMMUNICATION',
    description:
      'Choose the two questions that best narrow a vague report, then write the message that asks the customer for those details.',
    interfaceType: InterfaceType.CASE_FILE_TEXT_AREA,
    spec: diagnosticQuestionsSpec,
  },
  {
    key: CustomerServiceTaskType.ESCALATION_HANDOFF,
    label: 'Escalation and handoff summary',
    openEndedComponentType: 'DRAFTED_COMMUNICATION',
    description:
      'Write a handoff to the receiving team that contains the required facts, the deadline and a clear ask.',
    interfaceType: InterfaceType.CASE_FILE_TEXT_AREA,
    spec: escalationHandoffSpec,
  },
  {
    key: CustomerServiceTaskType.TICKET_TRIAGE,
    label: 'Ticket triage',
    objectiveComponentType: 'KEYED_CLASSIFICATION',
    openEndedComponentType: 'WRITTEN_JUSTIFICATION',
    description:
      'Apply the triage guideline to a queue: choose the ticket to work first, assign an action to each other ticket, and justify the first pick.',
    interfaceType: InterfaceType.CASE_FILE_TEXT_AREA,
    spec: ticketTriageSpec,
  },
];

export const CustomerServiceRoleModule: RoleModule = {
  categoryKeys: [RoleCategory.CUSTOMER_SERVICE],

  extraction: {
    categorySubDomainGuidance:
      'Customer service sub-domains include Tier 1 support, Complaints and Escalations, Technical Support, ' +
      'Contact Centre, and Support Lead. Retention and renewal work is "Sales > CSM", not customer service. Extract the specific sub-domain the job describes (e.g. ' +
      '"Customer Service > Complaints"), not just "Customer Service", when the description supports it.',
    intentFramingGuidance:
      'Customer service intent centers on applying policy correctly, de-escalating, communicating clearly ' +
      'in writing, and handing cases over with the facts intact.',
    expectedTaskGuidance:
      'Customer service is written work against a policy: the candidate is given a case file and replies to ' +
      'a customer or hands a case over. Choose the task type whose case the scenario naturally has.',
  },

  allowedTaskPatternTypes: customerServiceTaskPatternTypes,

  criticChecks: {
    validateTask: (task: GeneratedTaskCandidate) => {
      const figures = unsourcedFigures(task);
      return figures.length === 0
        ? []
        : [
            `The text states figures the case file does not show (${figures.join(', ')}). Remove them, or put them in the case file.`,
          ];
    },
  },
};
