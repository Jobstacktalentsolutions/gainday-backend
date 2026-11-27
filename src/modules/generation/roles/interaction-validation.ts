import { z } from 'zod';
import { INTERACTION, type ObjectiveComponentType, TaskSpecError } from './role-module.interface';
import { InterfaceType } from './interface-type';

const labels = z.array(z.string().trim().min(1)).min(2);
const unique = (values: string[]) => new Set(values).size === values.length;
const indexIn = (index: number, length: number) => Number.isInteger(index) && index >= 0 && index < length;

/** The first thing wrong with the interaction, in words the model can act on, or null when it is valid. */
function interactionProblem(
  type: ObjectiveComponentType | undefined,
  value: unknown,
): string | null {
  if (type === INTERACTION.CLASSIFICATION) {
    const result = z.object({ items: labels, buckets: labels }).safeParse(value);
    if (!result.success) return 'items and buckets each need at least 2 non-empty labels';
    if (!unique(result.data.items)) return 'items must be distinct';
    if (!unique(result.data.buckets)) return 'buckets must be distinct';
  } else if (type === INTERACTION.PRIORITY_RANKING) {
    const result = z
      .object({
        items: z
          .array(z.object({ label: z.string().trim().min(1), description: z.string().trim().min(1) }))
          .min(2),
      })
      .safeParse(value);
    if (!result.success) return 'at least 2 items are needed, each with a non-empty label and description';
    if (!unique(result.data.items.map((item) => item.label))) return 'item labels must be distinct';
  } else if (type === INTERACTION.PROCEDURAL_SEQUENCING) {
    const result = z.object({ steps: labels, correctOrder: z.array(z.number()) }).safeParse(value);
    if (!result.success) return 'at least 2 non-empty steps are needed';
    const { steps, correctOrder } = result.data;
    if (!unique(steps)) return 'steps must be distinct';
    if (
      correctOrder.length !== steps.length ||
      new Set(correctOrder).size !== steps.length ||
      !correctOrder.every((index) => indexIn(index, steps.length))
    ) {
      return `correctOrder must list each step position from 0 to ${steps.length - 1} exactly once`;
    }
  } else if (type === INTERACTION.SINGLE_BEST_ACTION) {
    const result = z.object({ options: labels, correctOptionIndex: z.number() }).safeParse(value);
    if (!result.success) return 'at least 2 non-empty options and a correctOptionIndex are needed';
    const { options, correctOptionIndex } = result.data;
    if (!unique(options)) return 'options must be distinct';
    if (!indexIn(correctOptionIndex, options.length)) {
      return `correctOptionIndex must be a position from 0 to ${options.length - 1}`;
    }
  } else if (type === INTERACTION.MULTI_SELECT_UNDER_CONSTRAINT) {
    const result = z
      .object({ options: labels, selectCount: z.number(), correctOptionIndices: z.array(z.number()) })
      .safeParse(value);
    if (!result.success) return 'at least 2 non-empty options, a selectCount and correctOptionIndices are needed';
    const { options, selectCount, correctOptionIndices } = result.data;
    if (!unique(options)) return 'options must be distinct';
    if (!Number.isInteger(selectCount) || selectCount < 1 || selectCount >= options.length) {
      return `selectCount must be a whole number from 1 to ${options.length - 1}`;
    }
    if (
      correctOptionIndices.length !== selectCount ||
      new Set(correctOptionIndices).size !== selectCount ||
      !correctOptionIndices.every((index) => indexIn(index, options.length))
    ) {
      return `correctOptionIndices must list ${selectCount} different positions from 0 to ${options.length - 1}`;
    }
  }
  return null;
}

/** Validate relationships that the structured-output schema cannot express to the model. */
export function validateInteraction(type: ObjectiveComponentType | undefined, value: unknown): void {
  const problem = interactionProblem(type, value);
  if (problem) throw new TaskSpecError(`The interaction is invalid: ${problem}.`);
}

export function validateInteractionPresentation(type: ObjectiveComponentType | undefined, value: unknown, interfaceType: InterfaceType, payload: unknown): void {
  if (type !== INTERACTION.CLASSIFICATION || interfaceType !== InterfaceType.TABLE_VIEW_RESPONSE_PANEL) return;
  const component = z.object({ items: labels }).safeParse(value);
  const table = z.object({ table: z.object({ rows: z.array(z.array(z.string()).min(1)) }) }).safeParse(payload);
  if (!component.success || !table.success) throw new TaskSpecError('Classification items and table rows are required.');
  const rows = table.data.table.rows;
  if (component.data.items.length !== rows.length || component.data.items.some((item, index) => item !== rows[index][0])) {
    throw new TaskSpecError('Classification items must match the first column of the table in order.');
  }
}
