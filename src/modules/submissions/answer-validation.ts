import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { CandidateAnswer } from '../../db/schema/submissions.schema';
import type { SimulationTask } from '../../db/schema/simulations.schema';
import { RoleRegistry } from '../generation/roles/role-registry';
import { OBJECTIVE_RESPONSE_SCHEMAS } from '../generation/roles/component-schemas';

const answerEnvelopeSchema = z.object({
  taskId: z.string().min(1),
  responseBody: z.string(),
  textResponse: z.string(),
  timeSpentSeconds: z.number().nonnegative(),
  objectiveResponse: z.unknown(),
});

/** The response shape the task's objective part expects, or `null` for a task that has none. */
function objectiveResponseSchemaFor(task: SimulationTask, roleRegistry: RoleRegistry) {
  const componentType = roleRegistry
    .resolve(task.category)
    .allowedTaskPatternTypes.find((t) => t.key === task.taskType)?.objectiveComponentType;
  return componentType ? OBJECTIVE_RESPONSE_SCHEMAS[componentType] : z.null();
}

/**
 * Validates a candidate's submitted answers against the simulation they belong to. The objective
 * response is checked against its own task's component type, because the backend grades it:
 * an answer the grader cannot read must be rejected here, not silently scored as wrong.
 */
export function parseAnswers(
  raw: unknown,
  tasks: SimulationTask[],
  roleRegistry: RoleRegistry,
): CandidateAnswer[] {
  const envelopes = z.array(answerEnvelopeSchema).safeParse(raw);
  if (!envelopes.success) {
    throw new BadRequestException(`answers are invalid: ${envelopes.error.message}`);
  }

  return envelopes.data.map((answer, index) => {
    const task = tasks.find((t) => t.id === answer.taskId);
    if (!task) {
      throw new BadRequestException(
        `answers[${index}].taskId is not a task of this simulation`,
      );
    }
    const objective = objectiveResponseSchemaFor(task, roleRegistry).safeParse(
      answer.objectiveResponse,
    );
    if (!objective.success) {
      throw new BadRequestException(
        `answers[${index}].objectiveResponse does not match the task's objective part: ${objective.error.message}`,
      );
    }
    return { ...answer, objectiveResponse: objective.data };
  });
}
