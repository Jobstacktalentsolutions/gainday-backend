import { SimulationTask } from '../../db/schema/simulations.schema';
import { placeReviewedTask } from './simulation-tasks.util';

const task = (id: string, slotIndex?: number, inReview = false): SimulationTask =>
  ({
    id,
    title: id,
    slotIndex,
    inReview,
  }) as unknown as SimulationTask;

describe('placeReviewedTask', () => {
  // Regression: slot 2 produced no task, so the saved tasks are slots 0, 1 and 3 at positions 0-2.
  // Position 2 must not be treated as slot 2.
  it('replaces the task in its own slot even when earlier slots left gaps', () => {
    const tasks = [task('s0', 0, true), task('s1', 1, true), task('s3', 3)];
    const result = placeReviewedTask(tasks, 1, task('edited-s1'));
    expect(result.map((t) => t.id)).toEqual(['s0', 'edited-s1', 's3']);
    expect(result[1].slotIndex).toBe(1);
  });

  it('inserts a slot that has no saved task in slot order', () => {
    const tasks = [task('s0', 0), task('s3', 3)];
    const result = placeReviewedTask(tasks, 2, task('new-s2'));
    expect(result.map((t) => t.id)).toEqual(['s0', 'new-s2', 's3']);
  });

  it('appends a slot after every saved task', () => {
    const tasks = [task('s0', 0)];
    expect(placeReviewedTask(tasks, 3, task('new-s3')).map((t) => t.id)).toEqual(['s0', 'new-s3']);
  });

  it('falls back to a legacy flagged task that has no slot index', () => {
    const tasks = [task('old-flagged', undefined, true), task('s3', 3)];
    const result = placeReviewedTask(tasks, 1, task('edited'));
    expect(result.map((t) => t.id)).toEqual(['edited', 's3']);
  });
});
