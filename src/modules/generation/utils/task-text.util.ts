import { TaskSpecError } from '../roles/role-module.interface';
import { countWords } from '../../../utils/word-count.util';

const MIN_SCENARIO_WORDS = 10;

/**
 * A task the candidate cannot read is not a task. The schema cannot require a minimum length (strict
 * Structured Outputs reject it), so an empty title or a near-empty scenario is rejected here and the
 * draft is retried like any other draft the model could not complete.
 */
export function requireTaskText(
  title: string,
  scenarioDescription: string,
): void {
  if (countWords(title) === 0) {
    throw new TaskSpecError('The task has no title.');
  }
  if (countWords(scenarioDescription) < MIN_SCENARIO_WORDS) {
    throw new TaskSpecError(
      `The scenario needs at least ${MIN_SCENARIO_WORDS} words describing the situation.`,
    );
  }
}
