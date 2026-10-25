import { z } from 'zod';

// Shape preserved from ANCHOR_ARCHITECTURE.md Section 2, including the schema-compatibility
// constraints documented there:
// - `score` is a plain z.number() (not z.literal()/z.tuple()) — Gemini rejects the JSON-Schema
//   `const`/positional-`items` those compile to. Exact score-point-and-order enforcement instead
//   happens in application code: see findAnchorShapeProblem below.
// - The root is wrapped in z.object({ anchors: [...] }) — a bare z.array() at the root is
//   rejected by Groq's OpenAI-compatible schema validator ("schema must have type 'object'").
// - No .refine()/.transform(): strict Structured Outputs (Fireworks) cannot represent a ZodEffects
//   and rejects the whole call before it reaches the model.
const anchorCriteriaSchema = z.object({
  problemSolving: z.string(),
  judgmentExecution: z.string(),
  writtenCommunication: z.string(),
  commercialDomainAwareness: z.string(),
});

// A promise the reply makes. The kinds match CommitmentKind in question-bank.schema.ts.
const commitmentSchema = z.object({
  kind: z.enum(['CASH_REFUND', 'STORE_CREDIT', 'COMPENSATION', 'ESCALATION']),
  amount: z.number().nullable().describe('The amount the reply states, or null if none.'),
});

const anchorSchema = z.object({
  score: z.number(),
  commitments: z
    .array(commitmentSchema)
    .describe('Each promise the reply makes to the customer. [] if it makes none.'),
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
      ),
  });
}

/** What the schema can no longer enforce: exactly one anchor per configured score point, in order.
 *  Returns a description of the problem, or null when the set is well-formed. */
export function findAnchorShapeProblem(
  anchors: { score: number }[],
  anchorScorePoints: number[],
): string | null {
  if (
    anchors.length === anchorScorePoints.length &&
    anchors.every((anchor, i) => anchor.score === anchorScorePoints[i])
  ) {
    return null;
  }
  return `expected exactly ${anchorScorePoints.length} anchors with scores ${anchorScorePoints.join(', ')} in that order, got ${anchors.length} with scores ${anchors.map((a) => a.score).join(', ') || 'none'}`;
}
