import { Logger } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { plannedSimulationSchema } from '../schemas/task-candidate.schema';
import { getSeniorityPlanningGuidance } from '../task-text-rules';
import {
  RoleModuleNotConfiguredError,
  TaskPatternTypeDefinition,
} from '../roles/role-module.interface';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { TaskCandidateRecord } from '../../../db/schema/job-extractions.schema';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';
import { DEFAULT_SIMULATION_TIME_LIMIT_MINUTES } from '../../../db/schema/simulations.schema';

const logger = new Logger('GenerationPipeline:planTasks');

export function buildPlanTasksPrompt(
  targetCount: number,
  allowedTypesCount: number,
  skillLevel?: string | null,
): string {
  const isConstrained = allowedTypesCount < targetCount;

  const constraintRules = isConstrained
    ? `CONSTRAINTS:
1. Only ${allowedTypesCount} task types exist for this role, but exactly ${targetCount} tasks are required.
2. You MUST use every available task type at least once.
3. For remaining slots, duplicate the task type(s) most crucial to this job. Give each duplicate a distinct scenario and briefDescription.
4. Each candidateId must be unique ("cand-1", "cand-2", ...).
5. Do not invent new task types.`
    : `CONSTRAINTS:
1. Every task must have a UNIQUE taskType from the allowed list (no duplicates).
2. Gear towards selecting taskTypes that are inline with the Job.
2. Each candidateId must be unique ("cand-1", "cand-2", ...).
3. Do not invent new task types.`;

  return [
    `Plan exactly ${targetCount} realistic simulation tasks for this role.`,
    `Together the tasks must fit in ${DEFAULT_SIMULATION_TIME_LIMIT_MINUTES} minutes, including reading and answering. Keep each focused on a manageable piece of work.`,
    'Choose work aligned with the stated Category, Intent, and Problem.',
    '',
    getSeniorityPlanningGuidance(skillLevel),
    '',
    constraintRules,
  ].join('\n');
}

export interface TaskPlanRequest {
  targetCount: number;
  allowedTypes: TaskPatternTypeDefinition[];
  category: string;
  intent: string;
  problem: string | null;
  skillLevel?: string | null;
}

/** Asks the model to plan the simulation's tasks. Shared by the pipeline and the seniority evaluation. */
export async function requestTaskPlan(
  model: BaseChatModel,
  request: TaskPlanRequest,
) {
  const allowedTypeKeys = request.allowedTypes.map((t) => t.key) as [
    string,
    ...string[],
  ];
  const planner = withGeminiSafeStructuredOutput(
    model,
    plannedSimulationSchema(allowedTypeKeys),
  );
  const allowedTypesDescription = request.allowedTypes
    .map((t) => `- ${t.key}: ${t.description}`)
    .join('\n');
  const prompt = buildPlanTasksPrompt(
    request.targetCount,
    allowedTypeKeys.length,
    request.skillLevel,
  );
  return planner.invoke([
    new SystemMessage(
      `${prompt}\n\nAllowed task types:\n${allowedTypesDescription}`,
    ),
    new HumanMessage(
      JSON.stringify({
        category: request.category,
        intent: request.intent,
        problem: request.problem,
        skillLevel: request.skillLevel ?? null,
      }),
    ),
  ]);
}

export function planTasksNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    const targetCount = ctx.config.selectedTaskCount;
    const allowedTypes = state.roleModule.allowedTaskPatternTypes;
    const allowedTypeKeys = allowedTypes.map((t) => t.key);
    if (allowedTypeKeys.length === 0) {
      throw new RoleModuleNotConfiguredError(state.category);
    }

    const isConstrained = allowedTypeKeys.length < targetCount;
    logger.log(
      `Planning ${targetCount} simulation tasks for job ${state.jobId} (category="${state.category}", availableTypes=${allowedTypeKeys.length}, constrained=${isConstrained})`,
    );

    const result = await requestTaskPlan(ctx.generationModel, {
      targetCount,
      allowedTypes,
      category: state.category,
      intent: state.intent,
      problem: state.problem,
      skillLevel: state.skillLevel,
    });

    let candidatePool: TaskCandidateRecord[] = [];

    if (!isConstrained) {
      // Standard Case (N >= K): Strictly unique task types
      const seenTypes = new Set<string>();
      const candidateList: TaskCandidateRecord[] = [];

      for (const c of result.candidates) {
        if (!seenTypes.has(c.taskType)) {
          seenTypes.add(c.taskType);
          candidateList.push({
            candidateId: c.candidateId,
            taskType: c.taskType,
            briefDescription: c.briefDescription,
            selected: true,
          });
        }
      }

      // If any duplicates were filtered out, fill with unused allowed types
      if (candidateList.length < targetCount) {
        const unusedTypes = allowedTypes.filter((t) => !seenTypes.has(t.key));
        for (const t of unusedTypes) {
          if (candidateList.length >= targetCount) break;
          seenTypes.add(t.key);
          candidateList.push({
            candidateId: `cand-${candidateList.length + 1}`,
            taskType: t.key,
            briefDescription: `Practical on-the-job exercise testing ${t.description.toLowerCase()}`,
            selected: true,
          });
        }
      }

      candidatePool = candidateList.slice(0, targetCount).map((c, i) => ({
        ...c,
        candidateId: `cand-${i + 1}`,
      }));
    } else {
      // Constrained Case (N < K): Use every available type at least once, duplicate crucial types
      const seenTypes = new Set<string>();
      const candidateList: TaskCandidateRecord[] = [];

      for (const c of result.candidates) {
        seenTypes.add(c.taskType);
        candidateList.push({
          candidateId: c.candidateId,
          taskType: c.taskType,
          briefDescription: c.briefDescription,
          selected: true,
        });
      }

      // Guarantee every allowed type is included at least once
      const missingTypes = allowedTypes.filter((t) => !seenTypes.has(t.key));
      for (const missing of missingTypes) {
        // If candidate list already meets or exceeds targetCount, replace a duplicate entry
        const typeCounts = new Map<string, number>();
        for (const c of candidateList) {
          typeCounts.set(c.taskType, (typeCounts.get(c.taskType) ?? 0) + 1);
        }

        let duplicateIdx = -1;
        for (let i = candidateList.length - 1; i >= 0; i--) {
          if ((typeCounts.get(candidateList[i].taskType) ?? 0) > 1) {
            duplicateIdx = i;
            break;
          }
        }

        const injected: TaskCandidateRecord = {
          candidateId: `cand-injected-${missing.key}`,
          taskType: missing.key,
          briefDescription: `Practical on-the-job exercise testing ${missing.description.toLowerCase()}`,
          selected: true,
        };

        if (candidateList.length >= targetCount && duplicateIdx !== -1) {
          candidateList[duplicateIdx] = injected;
        } else {
          candidateList.push(injected);
        }
        seenTypes.add(missing.key);
      }

      // If still fewer than targetCount, repeat the primary allowed types
      let fillIdx = 0;
      while (candidateList.length < targetCount) {
        const fallbackType = allowedTypes[fillIdx % allowedTypes.length];
        candidateList.push({
          candidateId: `cand-fill-${candidateList.length + 1}`,
          taskType: fallbackType.key,
          briefDescription: `Focused scenario testing ${fallbackType.description.toLowerCase()}`,
          selected: true,
        });
        fillIdx++;
      }

      candidatePool = candidateList.slice(0, targetCount).map((c, i) => ({
        ...c,
        candidateId: `cand-${i + 1}`,
      }));
    }

    logger.log(
      `Planned ${candidatePool.length} tasks: ${candidatePool.map((c) => `${c.candidateId}[${c.taskType}]`).join(', ')}`,
    );

    return {
      candidatePool,
      selectedCandidates: candidatePool,
    };
  };
}
