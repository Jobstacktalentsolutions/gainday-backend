import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AnchorResponse,
  QuestionBankTaskContent,
} from '../../../db/schema/question-bank.schema';

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
}

export interface ExtractionResult {
  category: string;
  intent: string;
  problem: string | null;
}

export interface GeneratedTaskCandidate {
  taskType: string;
  taskContent: QuestionBankTaskContent;
  anchors: AnchorResponse[];
}

export interface AnchorCorrectnessResult {
  sound: boolean;
  reasons: string[];
}

export interface RelevanceCheckResult {
  relevant: boolean;
  reasons: string[];
}

export interface RoleModule {
  /** Category value(s) this module handles. Matched via RoleRegistry (exact, then '>'-prefix fallback). */
  readonly categoryKeys: string[];

  readonly extraction: {
    categorySubDomainGuidance: string;
    intentFramingGuidance: string;
    expectedTaskGuidance: string;
  };

  /** Task-pattern types allowed for this role. Task-type selection is constrained to this
   *  list before any randomization (doc Section 4). An empty array means the role has no
   *  usable content yet — callers must fail fast rather than silently falling back. */
  readonly allowedTaskPatternTypes: TaskPatternTypeDefinition[];

  /** The 4 anchor-response criteria are fixed and shared across roles (doc Section 6.2);
   *  only their framing/interpretation is role-specific. */
  readonly anchorCriteriaFraming: {
    problemSolving: string;
    judgmentExecution: string;
    writtenCommunication: string;
    commercialDomainAwareness: string;
  };

  readonly criticChecks: {
    /** Role-specific soundness check on the anchors themselves (doc Section 7.1) —
     *  there is no external grounding source, so this is a second-pass LLM check. */
    checkAnchorCorrectness(
      task: GeneratedTaskCandidate,
      criticModel: BaseChatModel,
    ): Promise<AnchorCorrectnessResult>;
    /** Optional role-specific relevance nuance beyond the generic Category/Intent check.
     *  Return null to defer entirely to the generic check. */
    additionalRelevanceCheck?(
      task: GeneratedTaskCandidate,
      extraction: ExtractionResult,
      criticModel: BaseChatModel,
    ): Promise<RelevanceCheckResult | null>;
  };

  readonly presentationSpec: {
    rendererHint: string;
    notes: string;
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
