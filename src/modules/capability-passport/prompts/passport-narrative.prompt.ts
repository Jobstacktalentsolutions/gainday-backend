export interface RecentSubmissionSummary {
  domain: string;
  overallScore: number;
  categoryScores: {
    problemSolving: number;
    judgmentExecution: number;
    writtenCommunication: number;
    commercialDomainAwareness: number;
  };
  /** Each task's existing 1-2 sentence candidate-facing summary — already concise, so these are
   *  reused rather than re-sending raw task evidence/answers. */
  taskSummaries: string[];
}

export interface PassportNarrativeInput {
  compositeScore: number;
  compositeDelta: number;
  weakestCategory: string;
  weakestDomain: string;
  /** Last 3 graded submissions, most recent first. */
  recentSubmissions: RecentSubmissionSummary[];
}

export function buildPassportNarrativePrompt(): string {
  return `You are writing two short pieces of candidate-facing text for a "Capability Passport" —
a rolling summary of a candidate's performance across every job simulation they've completed.

You are given: the candidate's current composite capability score and its recent change, their
weakest scoring category and domain overall, and a condensed view of their most recent 3 graded
simulations (each one's domain, overall score, category scores 0-100, and the short per-task
summaries already written for the candidate during grading). Do not re-derive or re-state the
numeric scores yourself — use them only to ground what you write.

Write:
1. "whatStoodOut" — one or two sentences, neutral voice (never "you" or "your" — this is shown to
   both the candidate and any employer viewing their profile), naming something specific and
   genuine from their recent work, not a generic compliment.
2. "improvementSuggestions" — concise, constructive, second-person coaching sentences (candidate
   reads these privately — employers never see them). At most one per category that's genuinely
   worth calling out, plus at most one "OVERALL" suggestion if there's a cross-cutting pattern.
   Skip a category entirely if there's nothing specific and useful to say about it — do not pad.

Keep everything short. No filler, no restating the scores in prose form.`;
}
