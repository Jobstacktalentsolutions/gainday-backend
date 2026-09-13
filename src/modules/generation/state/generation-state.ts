import { Annotation } from '@langchain/langgraph';
import { RoleModule } from '../roles/role-module.interface';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import { TaskCandidateRecord } from '../../../db/schema/job-extractions.schema';
import { FailedGenerationAttempt } from '../../../db/schema/generation-review.schema';

export interface TaskDraft {
  candidateId: string;
  taskType: string;
  taskContent: QuestionBankTaskContent;
}

export interface FinalizedTask extends TaskDraft {
  /** The persisted question_bank row this task was inserted as — grading looks up anchors
   *  by this id, so it must survive from persist.node.ts through to SimulationTask. Only
   *  known once persist.node.ts has actually inserted the row, hence the separate TaskDraft
   *  type for currentTaskDraft (pre-persist, no id yet). */
  questionBankId: string;
}

export interface CriticResult {
  passed: boolean;
  failureReasons: string[];
  noveltyDistance: number | null;
  isDuplicate: boolean;
  relevant: boolean;
  /** Embedding computed for the novelty/duplicate check — carried forward so persist.node.ts
   *  doesn't recompute it for the same unchanged taskContent. */
  embedding: number[];
}

export const GenerationStateAnnotation = Annotation.Root({
  // Input
  jobId: Annotation<string>,
  jobDescription: Annotation<string>,
  requiredSkills: Annotation<string[]>,
  businessProblemRaw: Annotation<string | undefined>,

  // Stage 3 output
  category: Annotation<string>,
  intent: Annotation<string>,
  problem: Annotation<string | null>,
  roleModule: Annotation<RoleModule>,

  // Stage 4 output
  candidatePool: Annotation<TaskCandidateRecord[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  selectedCandidates: Annotation<TaskCandidateRecord[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),

  // Per-slot loop state
  currentSlotIndex: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  currentAttempt: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  triedCandidateIds: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  finalizedTasks: Annotation<FinalizedTask[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  adminReviewItems: Annotation<
    {
      slotIndex: number;
      category: string;
      attempts: FailedGenerationAttempt[];
    }[]
  >({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),

  currentTaskDraft: Annotation<TaskDraft | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  currentCriticResult: Annotation<CriticResult | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
});

export type GenerationState = typeof GenerationStateAnnotation.State;
export type GenerationStateUpdate = typeof GenerationStateAnnotation.Update;
