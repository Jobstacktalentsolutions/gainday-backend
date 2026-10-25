import { z } from 'zod';

export const relevanceCheckSchema = z.object({
  relevant: z.boolean(),
  reasons: z.array(z.string()),
});

// The generic critic call: relevance plus the coaching sentences in the candidate-facing text.
// An empty coachingSentences list passes.
export const taskCriticSchema = relevanceCheckSchema.extend({
  coachingSentences: z.array(z.string()),
});
