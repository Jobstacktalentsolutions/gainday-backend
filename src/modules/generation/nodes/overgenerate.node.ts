import { Logger } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { candidatePoolSchema } from '../schemas/task-candidate.schema';
import { RoleModuleNotConfiguredError } from '../roles/role-module.interface';
import { TaskCandidateRecord } from '../../../db/schema/job-extractions.schema';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';

const logger = new Logger('GenerationPipeline:overgenerate');

const OVERGENERATE_PROMPT = `Generate a diverse candidate pool of plausible on-the-job tasks for
this role, using general and industry-specific knowledge. Generate more candidates than will
ultimately be used — variety at this stage is what avoids repetitive/generic output later.
Each candidate's taskType MUST be one of the allowed types listed below; do not invent new types.`;

export function overgenerateNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    logger.log(
      `Overgenerating candidate pool for job ${state.jobId} (category="${state.category}", target pool size ${ctx.config.candidatePoolSize})`,
    );

    const allowedTypeKeys = state.roleModule.allowedTaskPatternTypes.map(
      (t) => t.key,
    );
    if (allowedTypeKeys.length === 0) {
      throw new RoleModuleNotConfiguredError(state.category);
    }

    const schema = candidatePoolSchema(
      allowedTypeKeys as [string, ...string[]],
    );
    const model = withGeminiSafeStructuredOutput(ctx.generationModel, schema);

    const allowedTypesDescription = state.roleModule.allowedTaskPatternTypes
      .map((t) => `- ${t.key}: ${t.description}`)
      .join('\n');

    const result = await model.invoke([
      new SystemMessage(
        `${OVERGENERATE_PROMPT}\n\nAllowed task types:\n${allowedTypesDescription}\n\nGenerate exactly ${ctx.config.candidatePoolSize} candidates.`,
      ),
      new HumanMessage(
        JSON.stringify({
          category: state.category,
          intent: state.intent,
          problem: state.problem,
        }),
      ),
    ]);

    const candidatePool: TaskCandidateRecord[] = result.candidates.map((c) => ({
      candidateId: c.candidateId,
      taskType: c.taskType,
      briefDescription: c.briefDescription,
      selected: false,
    }));

    logger.log(
      `Generated ${candidatePool.length} candidates: ${candidatePool.map((c) => `${c.candidateId}[${c.taskType}]`).join(', ')}`,
    );

    return { candidatePool };
  };
}
