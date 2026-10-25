import { z } from 'zod';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { QuestionBankTaskContent, TaskRubric } from '../../../db/schema/question-bank.schema';
import { InterfaceType } from './interface-type';
import { RoleCategory } from './role-category.enum';

export type ObjectiveComponentType =
  | 'NUMERIC_INPUT'
  | 'CLASSIFICATION'
  | 'PROCEDURAL_SEQUENCING'
  | 'SINGLE_BEST_ACTION'
  | 'MULTI_SELECT_UNDER_CONSTRAINT'
  | 'PRIORITY_RANKING'
  | 'RECONCILIATION'
  | 'JOURNAL_ENTRY'
  | 'NUMERIC_TABLE'
  | 'KEYED_CLASSIFICATION';

export type OpenEndedComponentType =
  | 'WRITTEN_JUSTIFICATION'
  | 'DRAFTED_COMMUNICATION'
  | 'INTERPRETATION_ANALYSIS'
  | 'STAKEHOLDER_PUSHBACK_RESPONSE';

/** The render and answer-key data a spec-backed task derives from its raw inputs. */
export interface MaterializedTaskData {
  interfacePayload: Record<string, unknown>;
  objectiveComponent?: Record<string, unknown>;
  rubric?: TaskRubric;
}

/** Thrown when the model's raw inputs cannot form a valid task (e.g. a balance comes out
 *  negative). The generation node turns it into a failed critic check, so the slot regenerates. */
export class TaskSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskSpecError';
  }
}

/**
 * A task whose figures are computed in code, never written by the model (finance doc Section
 * 6.2). The model fills `dataSchema` with raw inputs; `materialize` derives the table, chart and
 * answer key from them, so every stored number follows from the inputs by construction.
 */
export interface TaskSpecTemplate {
  readonly dataSchema: z.ZodType;
  materialize(data: unknown): MaterializedTaskData;
}

export interface TaskPatternTypeDefinition {
  key: string;
  label: string;
  objectiveComponentType?: ObjectiveComponentType;
  openEndedComponentType?: OpenEndedComponentType;
  description: string;
  /** Declarative per task-pattern type, not chosen by the LLM. See InterfaceType in interface-type.ts. */
  interfaceType: InterfaceType;
  /** Set for tasks whose figures must be computed rather than generated (see TaskSpecTemplate). */
  spec?: TaskSpecTemplate;
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
    /** Deterministic role-specific checks on a generated task. Returns failure reasons; an empty
     *  array passes. */
    validateTask?(task: GeneratedTaskCandidate): string[];
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
