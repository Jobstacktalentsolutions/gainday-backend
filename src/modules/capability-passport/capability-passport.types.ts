// Mirrors gainday-frontend/src/features/capability-passport/types/passport.ts exactly, so the
// controller can return these shapes with no mapping layer on either side.

export type CategoryKey =
  | 'problemSolving'
  | 'judgmentExecution'
  | 'writtenCommunication'
  | 'commercialDomainAwareness';

export type CategoryKeyScores = Record<CategoryKey, number>;

export interface PassportDomain {
  id: string;
  name: string;
  simulationCount: number;
  score: number;
}

export interface CapabilityPassportSummary {
  compositeScore: number;
  compositeDelta: number;
  verifiedSimulationCount: number;
  lastUpdated: string;
  history: number[];
  dimensions: CategoryKeyScores;
  domains: PassportDomain[];
  whatStoodOut: string;
}

export interface ImprovementSuggestion {
  id: string;
  area: CategoryKey | 'OVERALL';
  text: string;
}

export interface CandidatePassport extends CapabilityPassportSummary {
  improvementSuggestions: ImprovementSuggestion[];
}
