import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { SimulationTask } from '../../db/schema/simulations.schema';
import { INTERFACE_SCHEMAS, InterfaceType } from '../generation/roles/interface-type';
import {
  OBJECTIVE_COMPONENT_SCHEMAS,
  OPEN_ENDED_COMPONENT_SCHEMAS,
} from '../generation/roles/component-schemas';
import { RoleRegistry } from '../generation/roles/role-registry';

const baseTaskSchema = z.object({
  id: z.string().min(1),
  questionBankId: z.string().nullable(),
  taskType: z.string().min(1),
  category: z.string().min(1),
  title: z.string().min(1),
  scenarioDescription: z.string(),
  questionPrompt: z.string(),
  objectiveComponent: z.record(z.string(), z.unknown()).optional(),
  openEndedComponent: z.record(z.string(), z.unknown()).optional(),
  businessProblemDerived: z.boolean(),
  interfaceType: z.nativeEnum(InterfaceType),
  interfacePayload: z.record(z.string(), z.unknown()),
});

/**
 * Validates a full simulation task array against the same zod contracts the generation graph
 * itself uses (INTERFACE_SCHEMAS / OBJECTIVE_COMPONENT_SCHEMAS / OPEN_ENDED_COMPONENT_SCHEMAS),
 * rather than re-declaring the shape via class-validator. PUT /simulations/:id previously
 * accepted `{ tasks: any[] }` with zero validation.
 */
export function validateSimulationTasks(
  tasks: unknown[],
  roleRegistry: RoleRegistry,
): SimulationTask[] {
  if (!Array.isArray(tasks)) {
    throw new BadRequestException('tasks must be an array');
  }

  return tasks.map((raw, index) => {
    const base = baseTaskSchema.safeParse(raw);
    if (!base.success) {
      throw new BadRequestException(
        `tasks[${index}] is invalid: ${base.error.message}`,
      );
    }
    const task = base.data;

    const interfacePayloadSchema = INTERFACE_SCHEMAS[task.interfaceType];
    const payloadResult = interfacePayloadSchema.safeParse(
      task.interfacePayload,
    );
    if (!payloadResult.success) {
      throw new BadRequestException(
        `tasks[${index}].interfacePayload does not match interfaceType "${task.interfaceType}": ${payloadResult.error.message}`,
      );
    }

    let roleModule;
    try {
      roleModule = roleRegistry.resolve(task.category);
    } catch {
      throw new BadRequestException(
        `tasks[${index}].category "${task.category}" has no registered role module`,
      );
    }

    const patternTypeDef = roleModule.allowedTaskPatternTypes.find(
      (t) => t.key === task.taskType,
    );
    if (!patternTypeDef) {
      throw new BadRequestException(
        `tasks[${index}].taskType "${task.taskType}" is not a recognized task-pattern type for category "${task.category}"`,
      );
    }

    if (patternTypeDef.objectiveComponentType) {
      const schema =
        OBJECTIVE_COMPONENT_SCHEMAS[patternTypeDef.objectiveComponentType];
      const result = schema.safeParse(task.objectiveComponent);
      if (!result.success) {
        throw new BadRequestException(
          `tasks[${index}].objectiveComponent does not match "${patternTypeDef.objectiveComponentType}": ${result.error.message}`,
        );
      }
    }

    if (patternTypeDef.openEndedComponentType) {
      const schema =
        OPEN_ENDED_COMPONENT_SCHEMAS[patternTypeDef.openEndedComponentType];
      const result = schema.safeParse(task.openEndedComponent);
      if (!result.success) {
        throw new BadRequestException(
          `tasks[${index}].openEndedComponent does not match "${patternTypeDef.openEndedComponentType}": ${result.error.message}`,
        );
      }
    }

    return task as SimulationTask;
  });
}
