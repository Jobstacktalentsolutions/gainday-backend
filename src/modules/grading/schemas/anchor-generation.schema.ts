import { z } from 'zod';

// Shape preserved from ANCHOR_ARCHITECTURE.md Section 2, including the schema-compatibility
// constraints documented there:
// - `score` is a plain z.number() (not z.literal()/z.tuple()) — Gemini rejects the JSON-Schema
//   `const`/positional-`items` those compile to. Exact score-point-and-order enforcement instead
//   happens in the .refine() below, in application code.
// - The root is wrapped in z.object({ anchors: [...] }) — a bare z.array() at the root is
//   rejected by Groq's OpenAI-compatible schema validator ("schema must have type 'object'").
const anchorCriteriaSchema = z.object({
  problemSolving: z.string(),
  judgmentExecution: z.string(),
  writtenCommunication: z.string(),
  commercialDomainAwareness: z.string(),
});

const anchorSchema = z.object({
  score: z.number(),
  responseText: z
    .string()
    .describe('A realistic candidate response that would earn this score.'),
  criteria: anchorCriteriaSchema,
});

export function anchorGenerationSchema(anchorScorePoints: number[]) {
  return z.object({
    anchors: z
      .array(anchorSchema)
      .describe(
        `Exactly ${anchorScorePoints.length} anchors, one per configured score point (${anchorScorePoints.join(', ')}), in that order.`,
      )
      .refine(
        (anchors) =>
          anchors.length === anchorScorePoints.length &&
          anchors.every((a, i) => a.score === anchorScorePoints[i]),
        {
          message: `anchors must have exactly ${anchorScorePoints.length} entries with scores ${anchorScorePoints.join(', ')} in that order`,
        },
      ),
  });
}
