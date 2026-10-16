import { z } from 'zod';

// Whole numbers 0-100, on the same scale as the anchor score points (anchorScorePoints in
// ai.config.ts) and the submission-level overallScore — see roll-up.ts.
const categoryScoreDetailSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.string(),
  evidence: z.string(),
});

export const taskGradingResultSchema = z.object({
  categoryScores: z.object({
    problemSolving: categoryScoreDetailSchema,
    judgmentExecution: categoryScoreDetailSchema,
    writtenCommunication: categoryScoreDetailSchema,
    commercialDomainAwareness: categoryScoreDetailSchema,
  }),
  summary: z
    .string()
    .describe(
      'One or two concise, candidate-facing sentences explaining why they received this ' +
        'score on this specific task — shown/emailed directly to the candidate, so write it ' +
        'to them directly ("You..."), not about them in the third person.',
    ),
});

export type TaskGradingResultOutput = z.infer<typeof taskGradingResultSchema>;
