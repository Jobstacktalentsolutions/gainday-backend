import { z } from 'zod';

// Scored 0-10 to match the anchor score points (anchorScorePoints in ai.config.ts), not the
// submission-level 0-100 overallScore — see roll-up.ts for that separate conversion.
const categoryScoreDetailSchema = z.object({
  score: z.number().min(0).max(10),
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
