import { Inject, Injectable } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { GRADING_MODEL } from '../ai/ai.constants';
import { withGeminiSafeStructuredOutput } from '../ai/gemini-structured-output.util';
import { AnchorResponse } from '../../db/schema/question-bank.schema';
import { taskGradingResultSchema } from './schemas/task-grading-result.schema';
import { buildTaskGradingPrompt } from './prompts/task-grading.prompt';
import { AnchorRoleRegistry } from './roles/anchor-role-registry';

export interface GradeTaskInput {
  category: string;
  taskTitle: string;
  scenarioDescription: string;
  questionPrompt: string;
  anchors: AnchorResponse[];
  candidateResponse: string;
}

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

  async gradeTask(input: GradeTaskInput) {
    const roleConfig = this.roleRegistry.resolve(input.category);
    const model = withGeminiSafeStructuredOutput(
      this.gradingModel,
      taskGradingResultSchema,
    );

    return model.invoke([
      new SystemMessage(buildTaskGradingPrompt(roleConfig.criteriaFraming)),
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
