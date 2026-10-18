/** Typed shape of the `grading` ConfigService namespace — see gradingConfig in
 *  src/config/ai.config.ts, wired in via src/config/configuration.ts. */
export interface GradingConfig {
  maxAnchorAttempts: number;
  maxJobAttempts: number;
  retryBackoffBaseMs: number;
  rateLimitBackoffBaseMs: number;
  rateLimitBackoffMaxMs: number;
  sweepIntervalMs: number;
  stuckThresholdMs: number;
  categoryWeights: {
    problemSolving: number;
    judgmentExecution: number;
    writtenCommunication: number;
    commercialDomainAwareness: number;
  };
}
