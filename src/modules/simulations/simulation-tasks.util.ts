import { SimulationTask } from '../../db/schema/simulations.schema';

/**
 * Puts a reviewed task into its generation slot. A slot is identified by `slotIndex`, never by array
 * position: a slot that produced no task leaves a gap, so position N does not always mean slot N.
 *
 * Replaces the flagged task for that slot. Tasks saved before `slotIndex` existed are matched by
 * their `inReview` flag instead. A slot with no task yet is inserted in slot order.
 */
export function placeReviewedTask(
  tasks: SimulationTask[],
  slotIndex: number,
  task: SimulationTask,
): SimulationTask[] {
  const placed = { ...task, slotIndex };

  const sameSlot = tasks.findIndex((t) => t.slotIndex === slotIndex);
  if (sameSlot !== -1) {
    return tasks.map((t, index) => (index === sameSlot ? placed : t));
  }

  const legacyFlagged = tasks.findIndex(
    (t) => t.slotIndex === undefined && t.inReview,
  );
  if (legacyFlagged !== -1) {
    return tasks.map((t, index) => (index === legacyFlagged ? placed : t));
  }

  const nextSlot = tasks.findIndex(
    (t) => t.slotIndex !== undefined && t.slotIndex > slotIndex,
  );
  if (nextSlot === -1) return [...tasks, placed];
  return [...tasks.slice(0, nextSlot), placed, ...tasks.slice(nextSlot)];
}
