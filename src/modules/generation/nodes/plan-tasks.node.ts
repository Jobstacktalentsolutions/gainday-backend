import { Logger } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { plannedSimulationSchema } from '../schemas/task-candidate.schema';
import { RoleModuleNotConfiguredError } from '../roles/role-module.interface';
import { TaskCandidateRecord } from '../../../db/schema/job-extractions.schema';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';

const logger = new Logger('GenerationPipeline:planTasks');

const PLAN_TASKS_PROMPT = `Generate a simulation plan of exactly 4 diverse on-the-job tasks for this role, using general and industry-specific knowledge. Favour tasks that need role-specific expertise rather than general office skills.

Select task types that best measure the specific skills needed for this job, maximizing:
- alignmentWithIntent: directly tests the stated Intent and required competencies.
- alignmentWithCategory: natural fit for the stated Category and seniority.
- problemIncorporationPotential: meaningfully incorporates the stated business Problem (if provided).

CRITICAL CONSTRAINTS:
1. Every task in this 4-task simulation MUST have a UNIQUE taskType selected from the allowed types listed below. No two tasks may share the same taskType.
2. Select 4 distinct task types that together form a comprehensive, varied assessment.
3. Each candidateId must be distinct (e.g. "cand-1", "cand-2", "cand-3", "cand-4").
4. Do not invent new types; only select from the allowed types listed below.`;

export function planTasksNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    const targetCount = ctx.config.selectedTaskCount;
    logger.log(
      `Planning ${targetCount} unique simulation tasks for job ${state.jobId} (category="${state.category}")`,
    );

    const allowedTypeKeys = state.roleModule.allowedTaskPatternTypes.map(
      (t) => t.key,
    );
    if (allowedTypeKeys.length === 0) {
      throw new RoleModuleNotConfiguredError(state.category);
    }

    const schema = plannedSimulationSchema(
      allowedTypeKeys as [string, ...string[]],
    );
    const model = withGeminiSafeStructuredOutput(ctx.generationModel, schema);

    const allowedTypesDescription = state.roleModule.allowedTaskPatternTypes
      .map((t) => `- ${t.key}: ${t.description}`)
      .join('\n');

    const result = await model.invoke([
      new SystemMessage(
        `${PLAN_TASKS_PROMPT}\n\nAllowed task types:\n${allowedTypesDescription}\n\nGenerate exactly ${targetCount} candidate tasks with unique taskTypes.`,
      ),
      new HumanMessage(
        JSON.stringify({
          category: state.category,
          intent: state.intent,
          problem: state.problem,
        }),
      ),
    ]);

    const seenTypes = new Set<string>();
    const uniqueCandidates: TaskCandidateRecord[] = [];
    for (const c of result.candidates) {
      if (!seenTypes.has(c.taskType)) {
        seenTypes.add(c.taskType);
        uniqueCandidates.push({
          candidateId: c.candidateId,
          taskType: c.taskType,
          briefDescription: c.briefDescription,
          selected: true,
        });
      }
    }

    // If any duplicate was filtered out and we have fewer than targetCount,
    // fill the gap using unused allowed task types for this role.
    if (uniqueCandidates.length < targetCount) {
      const unusedTypes = state.roleModule.allowedTaskPatternTypes.filter(
        (t) => !seenTypes.has(t.key),
      );
      for (const t of unusedTypes) {
        if (uniqueCandidates.length >= targetCount) break;
        seenTypes.add(t.key);
        uniqueCandidates.push({
          candidateId: `cand-${uniqueCandidates.length + 1}`,
          taskType: t.key,
          briefDescription: `Practical on-the-job exercise testing ${t.description.toLowerCase()}`,
          selected: true,
        });
      }
    }

    const candidatePool = uniqueCandidates.slice(0, targetCount);

    logger.log(
      `Planned ${candidatePool.length} tasks: ${candidatePool.map((c) => `${c.candidateId}[${c.taskType}]`).join(', ')}`,
    );

    return {
      candidatePool,
      selectedCandidates: candidatePool,
    };
  };
}
