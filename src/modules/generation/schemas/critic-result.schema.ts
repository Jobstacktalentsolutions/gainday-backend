import { z } from 'zod';

export const relevanceCheckSchema = z.object({
  relevant: z.boolean(),
  reasons: z.array(z.string()),
  // Sentences in the candidate-facing text that coach the answer. An empty list passes.
  coachingSentences: z.array(z.string()),
});
