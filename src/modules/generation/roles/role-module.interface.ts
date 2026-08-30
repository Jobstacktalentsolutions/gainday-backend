import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import { InterfaceType } from './interface-type';
import { RoleCategory } from './role-category.enum';

export type ObjectiveComponentType =
  | 'NUMERIC_INPUT'
  | 'CLASSIFICATION'
  | 'PROCEDURAL_SEQUENCING'
  | 'SINGLE_BEST_ACTION'
  | 'MULTI_SELECT_UNDER_CONSTRAINT';

export type OpenEndedComponentType =
  | 'WRITTEN_JUSTIFICATION'
  | 'DRAFTED_COMMUNICATION'
  | 'INTERPRETATION_ANALYSIS'
  | 'STAKEHOLDER_PUSHBACK_RESPONSE';

export interface TaskPatternTypeDefinition {
  key: string;
  label: string;
  objectiveComponentType?: ObjectiveComponentType;
  openEndedComponentType?: OpenEndedComponentType;
  description: string;
  /** Declarative per task-pattern type, not chosen by the LLM. See InterfaceType in interface-type.ts. */
  interfaceType: InterfaceType;
}

export interface ExtractionResult {
  category: string;
  intent: string;
  problem: string | null;
}

export interface GeneratedTaskCandidate {
  taskType: string;
  taskContent: QuestionBankTaskContent;
}

export interface RelevanceCheckResult {
  relevant: boolean;
  reasons: string[];
}

export interface RoleModule {
  /** Top-level Category value(s) this module handles, matched via RoleRegistry (exact, then
   *  '>'-prefix fallback for sub-domains like "Finance > Reconciliation" or "Sales > SDR"). */
  readonly categoryKeys: RoleCategory[];

  readonly extraction: {
    categorySubDomainGuidance: string;
    intentFramingGuidance: string;
    expectedTaskGuidance: string;
  };

  /** Task-pattern types allowed for this role. Task-type selection is constrained to this
   *  list before any randomization (doc Section 4). An empty array means the role has no
   *  usable content yet — callers must fail fast rather than silently falling back. */
  readonly allowedTaskPatternTypes: TaskPatternTypeDefinition[];

  readonly criticChecks: {
    /** Optional role-specific relevance nuance beyond the generic Category/Intent check.
     *  Return null to defer entirely to the generic check. */
    additionalRelevanceCheck?(
      task: GeneratedTaskCandidate,
      extraction: ExtractionResult,
      criticModel: BaseChatModel,
    ): Promise<RelevanceCheckResult | null>;
  };
}

export class RoleModuleNotConfiguredError extends Error {
  constructor(category: string) {
    super(
      `Role module for category "${category}" has no allowed task-pattern types configured.`,
    );
    this.name = 'RoleModuleNotConfiguredError';
  }
}

export class UnregisteredRoleCategoryError extends Error {
  constructor(category: string) {
    super(`No role module is registered for category "${category}".`);
    this.name = 'UnregisteredRoleCategoryError';
  }
}
