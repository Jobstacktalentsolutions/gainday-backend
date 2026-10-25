import { z } from 'zod';
import { MaterializedTaskData, TaskSpecTemplate, TaskSpecError } from './role-module.interface';

/** Builds a spec template: the model's raw inputs are parsed against `dataSchema`, then turned into
 *  the task's data by `materialize`. Parsing here (not only at generation) keeps every caller on
 *  the same contract. */
export function defineTaskSpec<T extends z.ZodType>(
  dataSchema: T,
  materialize: (data: z.infer<T>) => MaterializedTaskData,
): TaskSpecTemplate {
  return {
    dataSchema,
    materialize: (raw) => materialize(dataSchema.parse(raw)),
  };
}

/** Throws a TaskSpecError when `condition` is false — the single way a template rejects inputs. */
export function requireValid(condition: boolean, message: string): void {
  if (!condition) throw new TaskSpecError(message);
}

export function requireUnique(values: string[], what: string): void {
  requireValid(new Set(values).size === values.length, `${what} must be unique`);
}
