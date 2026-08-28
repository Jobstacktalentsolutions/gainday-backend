import { z } from 'zod';

export const judgeScoreSchema = z.object({
  scores: z.array(
    z.object({
      candidateId: z.string(),
      alignmentWithIntent: z.number().min(0).max(10),
      alignmentWithCategory: z.number().min(0).max(10),
      problemIncorporationPotential: z
        .number()
        .min(0)
        .max(10)
        .nullable()
        .describe('Only score this if a business Problem was extracted; otherwise null.'),
    }),
  ),
});
