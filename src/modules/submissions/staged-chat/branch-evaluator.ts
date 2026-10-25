/** Decides, after a reply is stored, whether a branch changes the next customer message. */
export interface BranchEvaluationInput {
  /** The turn the reply answers. */
  turn: number;
  reply: string;
}

export interface BranchEvaluator {
  /** A branch id from the task's script, or null for no branch. */
  evaluate(input: BranchEvaluationInput): string | null;
}

export const BRANCH_EVALUATOR = Symbol('BRANCH_EVALUATOR');

/** The only evaluator in this version: no branch ever applies. There are no LLM calls and no keyword
 *  matching here. A real evaluator replaces it by providing BRANCH_EVALUATOR. */
export class NoBranchEvaluator implements BranchEvaluator {
  evaluate(): null {
    return null;
  }
}
