/** Typed shape of the `grading` ConfigService namespace — see gradingConfig in
 *  src/config/ai.config.ts, wired in via src/config/configuration.ts. */
export interface GradingConfig {
  maxAnchorAttempts: number;
  categoryWeights: {
    problemSolving: number;
    judgmentExecution: number;
    writtenCommunication: number;
    commercialDomainAwareness: number;
  };
}
