import {
  INTERACTION,
  ObjectiveComponentType,
} from '../roles/role-module.interface';

/** A random permutation of 0..length-1 that is never the identity, so the shuffled order always differs. */
function shuffledPermutation(length: number): number[] {
  const identity = Array.from({ length }, (_, index) => index);
  if (length < 2) return identity;
  let permutation = identity;
  while (permutation.every((value, index) => value === index)) {
    permutation = [...identity];
    for (let i = permutation.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
  }
  return permutation;
}

/** Fills in the answer key the model is not asked for: a sequencing task is written in its correct order. */
export function withAnswerKey(
  type: ObjectiveComponentType | undefined,
  component: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (type === INTERACTION.PROCEDURAL_SEQUENCING && component) {
    const steps = component.steps as unknown[];
    return { ...component, correctOrder: steps.map((_, index) => index) };
  }
  return component;
}

/**
 * Presentation order is decided here, not by the model: items to rank and steps to order are shown in
 * the stored order, so the order the model wrote would otherwise be the one the candidate sees. A
 * sequencing answer key is remapped to the shuffled steps. Other component types pass through.
 */
export function shuffleObjectiveOrder(
  type: ObjectiveComponentType | undefined,
  component: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!component) return component;
  if (type === INTERACTION.PRIORITY_RANKING) {
    const items = component.items as unknown[];
    return {
      ...component,
      items: shuffledPermutation(items.length).map((index) => items[index]),
    };
  }
  if (type === INTERACTION.PROCEDURAL_SEQUENCING) {
    const steps = component.steps as unknown[];
    const correctOrder = component.correctOrder as number[];
    const permutation = shuffledPermutation(steps.length);
    // permutation[newIndex] is the old index, so the key maps each old index to its new one.
    const newIndexOf = new Map(
      permutation.map((oldIndex, newIndex) => [oldIndex, newIndex]),
    );
    return {
      ...component,
      steps: permutation.map((index) => steps[index]),
      correctOrder: correctOrder.map((oldIndex) => newIndexOf.get(oldIndex)),
    };
  }
  return component;
}
