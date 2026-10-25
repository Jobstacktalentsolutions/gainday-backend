import { InterfaceType } from '../generation/roles/interface-type';

/**
 * Whether a task's submitted answer goes through this grader. A staged chat is graded from its whole
 * transcript by a separate grader, so its single submitted answer is empty and must not be scored.
 */
export function isGradedByAnswer(task: { interfaceType: string }): boolean {
  return task.interfaceType !== InterfaceType.STAGED_CHAT;
}
