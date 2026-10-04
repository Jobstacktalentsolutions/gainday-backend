/** Per-role interpretation of the 4 fixed grading criteria, substituted into both the anchor-
 *  generation prompt and the task-grading prompt so anchors and actual candidate grading are
 *  judged against the same framing. Deliberately grading-local, not part of generation's
 *  RoleModule — anchors/grading are a separate concern from task generation (see
 *  src/modules/grading/README.md for why this was pulled out of generation). */
export interface AnchorCriteriaFraming {
  problemSolving: string;
  judgmentExecution: string;
  writtenCommunication: string;
  commercialDomainAwareness: string;
}

export interface CategoryWeights {
  problemSolving: number;
  judgmentExecution: number;
  writtenCommunication: number;
  commercialDomainAwareness: number;
}

export interface RoleAnchorConfig {
  criteriaFraming: AnchorCriteriaFraming;
  /** What "sound" means for this role's anchors — see ANCHOR_ARCHITECTURE.md Section 3. */
  anchorCorrectnessPrompt: string;
  /** Role-specific category weights for score roll-up (must sum to 1.0). */
  categoryWeights: CategoryWeights;
}
