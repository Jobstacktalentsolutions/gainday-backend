import { z } from 'zod';

// Anchor generation/critique was removed from this schema on 2026-08-30 — anchors are a
// grading-time concern, not a generation-time one. See src/modules/grading/README.md and
// ANCHOR_ARCHITECTURE.md for the full design (prompt text, schema shape, and why).

export const taskGenerationSchema = (
  allowedTypeKeys: [string, ...string[]],
  interfacePayloadSchema: z.ZodTypeAny,
  objectiveComponentSchema: z.ZodTypeAny | null,
  openEndedComponentSchema: z.ZodTypeAny | null,
) => {
  return z.object({
    taskType: z.enum(allowedTypeKeys),
    title: z.string(),
    scenarioDescription: z.string().describe('GitHub-flavored Markdown.'),
    // The one place the no-coaching rule is repeated outside the prompt: field descriptions travel
    // with the schema the model fills in, and this is the field where it gets broken.
    questionPrompt: z
      .string()
      .describe(
        'GitHub-flavored Markdown. One instruction: the deliverable, its recipient, format or length. No lists of points to cover, example tactics, or hints.',
      ),
    businessProblemDerived: z.boolean(),
    objectiveComponent: objectiveComponentSchema
      ? objectiveComponentSchema
      : z.null().describe('This task type has no objective component.'),
    openEndedComponent: openEndedComponentSchema
      ? openEndedComponentSchema
      : z.null().describe('This task type has no open-ended component.'),
    interfacePayload: interfacePayloadSchema.describe(
      "Data matching the render contract for this task's interfaceType — e.g. table rows/columns for TABLE_VIEW_RESPONSE_PANEL.",
    ),
  });
};
