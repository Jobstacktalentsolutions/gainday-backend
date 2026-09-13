import { z } from 'zod';

// Shape preserved from ANCHOR_ARCHITECTURE.md Section 4.
const anchorFeedbackItemSchema = z.object({
  anchorIndex: z.number(),
  sound: z.boolean(),
  // Required + nullable, not .optional() — models commonly emit an explicit `null` for an
  // unfilled field rather than omitting the key, and z.optional().nullable() compiles to an
  // anyOf/not shape that neither Gemini's nor Groq's schema validators accept. Plain .nullable()
  // compiles to a clean `type: [X, "null"]` both providers handle.
  issue: z.string().nullable(),
});

export const anchorCritiqueSchema = z.object({
  sound: z.boolean(),
  reasons: z.array(z.string()),
  anchorFeedback: z.array(anchorFeedbackItemSchema),
});

export type AnchorCritiqueResult = z.infer<typeof anchorCritiqueSchema>;
