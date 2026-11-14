import { z } from 'zod';
import { INTERACTION, type ObjectiveComponentType, TaskSpecError } from './role-module.interface';
import { InterfaceType } from './interface-type';

const labels = z.array(z.string().trim().min(1)).min(2);
const unique = (values: string[]) => new Set(values).size === values.length;
const indexIn = (index: number, length: number) => Number.isInteger(index) && index >= 0 && index < length;

/** Validate relationships that the structured-output schema cannot express to the model. */
export function validateInteraction(type: ObjectiveComponentType | undefined, value: unknown): void {
  let valid = true;
  if (type === INTERACTION.CLASSIFICATION) {
    const result = z.object({ items: labels, buckets: labels }).safeParse(value);
    valid = result.success && unique(result.data.items) && unique(result.data.buckets);
  } else if (type === INTERACTION.PRIORITY_RANKING) {
    const result = z.object({ items: z.array(z.object({ label: z.string().trim().min(1), description: z.string().trim().min(1) })).min(2) }).safeParse(value);
    valid = result.success && unique(result.data.items.map((item) => item.label));
  } else if (type === INTERACTION.PROCEDURAL_SEQUENCING) {
    const result = z.object({ steps: labels, correctOrder: z.array(z.number()) }).safeParse(value);
    if (!result.success) valid = false;
    else {
      const { steps, correctOrder } = result.data;
      valid = unique(steps) && correctOrder.length === steps.length &&
        new Set(correctOrder).size === steps.length && correctOrder.every((index) => indexIn(index, steps.length));
    }
  } else if (type === INTERACTION.SINGLE_BEST_ACTION) {
    const result = z.object({ options: labels, correctOptionIndex: z.number() }).safeParse(value);
    valid = result.success && unique(result.data.options) && indexIn(result.data.correctOptionIndex, result.data.options.length);
  } else if (type === INTERACTION.MULTI_SELECT_UNDER_CONSTRAINT) {
    const result = z.object({ options: labels, selectCount: z.number(), correctOptionIndices: z.array(z.number()) }).safeParse(value);
    if (!result.success) valid = false;
    else {
      const { options, selectCount, correctOptionIndices } = result.data;
      valid = unique(options) && Number.isInteger(selectCount) && selectCount > 0 && selectCount < options.length &&
        correctOptionIndices.length === selectCount && new Set(correctOptionIndices).size === selectCount &&
        correctOptionIndices.every((index) => indexIn(index, options.length));
    }
  }
  if (!valid) throw new TaskSpecError('The interaction has invalid or duplicate items, options, or answer indices.');
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
