import type { ObjectiveComponentType } from '../roles/role-module.interface';

/**
 * The instruction for each answer control is code-owned. The model writes the question for the written
 * part only, so it cannot list, letter or ask the candidate to type the control's items. Types whose
 * question a spec template writes have no entry here.
 */
const OBJECTIVE_INSTRUCTION: Record<ObjectiveComponentType, string> = {
  CLASSIFICATION: 'Sort each item into the group it belongs to.',
  KEYED_CLASSIFICATION: '',
  PRIORITY_RANKING: 'Rank the items from highest to lowest priority.',
  PROCEDURAL_SEQUENCING: 'Put the steps in the order you would follow.',
  SINGLE_BEST_ACTION: 'Choose the best option.',
  MULTI_SELECT_UNDER_CONSTRAINT: 'Choose the options that fit best.',
  NUMERIC_INPUT: '',
  NUMERIC_TABLE: '',
  RECONCILIATION: '',
  JOURNAL_ENTRY: '',
};

/** The instruction the platform adds for this answer control, or an empty string when it adds none. */
export function objectiveInstruction(type?: ObjectiveComponentType): string {
  return type ? OBJECTIVE_INSTRUCTION[type] : '';
}

/** The question the model wrote, with the answer control's instruction first. Safe to apply twice. */
export function withObjectiveInstruction(
  type: ObjectiveComponentType | undefined,
  question: string,
): string {
  const instruction = objectiveInstruction(type);
  if (!instruction) return question;
  const written = withoutObjectiveInstruction(type, question);
  return written ? `${instruction} ${written}` : instruction;
}

/** The part of the question the model owns, for showing back to it when a task is revised. */
export function withoutObjectiveInstruction(
  type: ObjectiveComponentType | undefined,
  question: string,
): string {
  const instruction = objectiveInstruction(type);
  const trimmed = question.trim();
  return instruction && trimmed.startsWith(instruction)
    ? trimmed.slice(instruction.length).trim()
    : trimmed;
}

const MIN_ITEM_CHARACTERS = 8;

const normalise = (text: string) =>
  text
    .replace(/[*_\s]+/g, ' ')
    .trim()
    .toLowerCase();

function itemTexts(component: Record<string, unknown>): string[] {
  const list = component.steps ?? component.options ?? component.items;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item: unknown) => {
    if (typeof item === 'string') return [item];
    const label = (item as { label?: unknown } | null)?.label;
    return typeof label === 'string' ? [label] : [];
  });
}

/**
 * The platform shows the answer control's items itself, so a question that repeats two or more of them
 * word for word is listing them. Returned as repair feedback; empty when the question is clean.
 */
export function questionRepeatsItems(
  question: string,
  component: Record<string, unknown> | null | undefined,
): string[] {
  if (!component) return [];
  const text = normalise(question);
  const repeated = itemTexts(component).filter((item) => {
    const candidate = normalise(item);
    return candidate.length >= MIN_ITEM_CHARACTERS && text.includes(candidate);
  });
  return repeated.length >= 2
    ? [
        "The question lists the answer control's items. Remove them: the platform shows them in the control.",
      ]
    : [];
}
