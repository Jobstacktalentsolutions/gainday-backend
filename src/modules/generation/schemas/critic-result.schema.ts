import { z } from 'zod';

export const relevanceCheckSchema = z.object({
  relevant: z.boolean(),
  reasons: z.array(z.string()),
});

// The generic critic call: relevance plus the tip sentences in the candidate-facing text.
// An empty tipSentences list passes.
export const taskCriticSchema = relevanceCheckSchema.extend({
  tipSentences: z
    .array(z.string())
    .describe(
      'Sentences quoted exactly from the candidate text that coach the candidate toward the answer; empty if none. Never list requirements or explanations.',
    ),
  presentationProblems: z
    .array(z.string())
    .describe(
      'Specific substantial duplication or unusable answer controls; empty if none.',
    ),
});
