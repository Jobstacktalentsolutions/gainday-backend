import { z } from 'zod';

export const relevanceCheckSchema = z.object({
  relevant: z.boolean(),
  reasons: z.array(z.string()),
});

// The generic critic call: relevance plus the tip sentences in the candidate-facing text.
// An empty tipSentences list passes.
export const taskCriticSchema = relevanceCheckSchema.extend({
  tipSentences: z.array(z.string()),
});
