import { Inject, Injectable } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { GRADING_MODEL } from '../ai/ai.constants';
import { withGeminiSafeStructuredOutput } from '../ai/gemini-structured-output.util';
import { AnchorResponse, TaskRubric } from '../../db/schema/question-bank.schema';
import {
  buildTaskGradingResultSchema,
  GradedCriterion,
  LlmCategoryScores,
  LlmGradeOutput,
  LlmRubricResult,
} from './schemas/task-grading-result.schema';
import { buildTaskGradingPrompt } from './prompts/task-grading.prompt';
import { AnchorRoleRegistry } from './roles/anchor-role-registry';

export interface GradeTaskInput {
  category: string;
  taskTitle: string;
  scenarioDescription: string;
  questionPrompt: string;
  anchors: AnchorResponse[];
  candidateResponse: string;
  /** The criteria the model scores. Criteria settled by an answer key are left to the caller. */
  criteria: readonly GradedCriterion[];
  /** Short description of the code-checked objective result, when there is one. */
  verifiedResult?: string;
  /** The task's checklist and gate, when the task has them. */
  rubric?: TaskRubric;
}

export type GradeTaskOutput = LlmGradeOutput;

/** Grades one candidate answer for one task against that task's own anchors — deliberately
 *  scoped to a single (task, answer, anchors) triple per call rather than batching a whole
 *  submission into one call, both for reliability (avoids the deep-nested-schema problems that
 *  forced anchors out of generation in the first place — see grading/README.md) and to keep the
 *  model's attention on one task's anchors at a time rather than N tasks' worth of unrelated
 *  calibration examples. */
@Injectable()
export class TaskGradingService {
  constructor(
    @Inject(GRADING_MODEL) private readonly gradingModel: BaseChatModel,
    private readonly roleRegistry: AnchorRoleRegistry,
  ) {}

  async gradeTask(input: GradeTaskInput): Promise<GradeTaskOutput> {
    const roleConfig = this.roleRegistry.resolve(input.category);
    const model = withGeminiSafeStructuredOutput(
      this.gradingModel,
      buildTaskGradingResultSchema(input.criteria, input.rubric),
    );

    return model.invoke([
      new SystemMessage(
        buildTaskGradingPrompt(
          roleConfig.criteriaFraming,
          input.criteria,
          input.verifiedResult,
          input.rubric,
        ),
      ),
      new HumanMessage(
        JSON.stringify({
          task: {
            title: input.taskTitle,
            scenarioDescription: input.scenarioDescription,
            questionPrompt: input.questionPrompt,
          },
          anchors: input.anchors,
          candidateResponse: input.candidateResponse,
        }),
      ),
    ]);
  }
}
