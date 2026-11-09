import { Logger } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { plannedSimulationSchema } from '../schemas/task-candidate.schema';
import { getSeniorityGuidance } from '../task-text-rules';
import { RoleModuleNotConfiguredError } from '../roles/role-module.interface';
import { TaskCandidateRecord } from '../../../db/schema/job-extractions.schema';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';

const logger = new Logger('GenerationPipeline:planTasks');

export function buildPlanTasksPrompt(
  targetCount: number,
  allowedTypesCount: number,
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
2. Each candidateId must be unique ("cand-1", "cand-2", ...).
3. Do not invent new task types.`;

  return `Plan exactly ${targetCount} realistic on-the-job simulation tasks for this role.
Prioritize role-specific expertise aligned with the stated Category, Intent, Problem, and Seniority / Skill Level (calibrate complexity, scope of responsibility, and expected depth according to whether this is Junior, Mid level, or Senior level).

${constraintRules}`;
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

    const schema = plannedSimulationSchema(
      allowedTypeKeys as [string, ...string[]],
    );
    const model = withGeminiSafeStructuredOutput(ctx.generationModel, schema);

    const allowedTypesDescription = allowedTypes
      .map((t) => `- ${t.key}: ${t.description}`)
      .join('\n');

    const prompt = buildPlanTasksPrompt(targetCount, allowedTypeKeys.length, state.skillLevel);

    const result = await model.invoke([
      new SystemMessage(
        `${prompt}\n\nAllowed task types:\n${allowedTypesDescription}`,
      ),
      new HumanMessage(
        JSON.stringify({
          category: state.category,
          intent: state.intent,
          problem: state.problem,
          skillLevel: state.skillLevel ?? null,
        }),
      ),
    ]);

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
