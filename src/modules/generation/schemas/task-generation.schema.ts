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
    expectedDurationMinutes: z
      .number()
      .int()
      .min(2)
      .max(15)
      .describe(
        'Whole minutes the candidate needs, reading and answering. Never more than the task time budget.',
      ),
    scenarioDescription: z.string().describe('GitHub-flavored Markdown.'),
    // The one place the no-tips rule is repeated outside the prompt: field descriptions travel
    // with the schema the model fills in, and this is the field where it gets broken.
    questionPrompt: z
      .string()
      .describe(
        'GitHub-flavored Markdown. The requirements of the deliverable only: one deliverable, at most 3 requirements. Never state word counts, limits, or length rules; the platform shows the word limit. No tips: approach advice, example tactics, or what a good answer does.',
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

/** Content and presentation requirements for tasks whose interface is chosen afterwards. */
export const flexibleTaskDraftSchema = (
  allowedTypeKeys: [string, ...string[]],
  objectiveComponentSchema: z.ZodTypeAny | null,
  openEndedComponentSchema: z.ZodTypeAny | null,
) =>
  taskGenerationSchema(
    allowedTypeKeys,
    z.null(),
    objectiveComponentSchema,
    openEndedComponentSchema,
  )
    .omit({ interfacePayload: true })
    .extend({
      presentationNeeds: z
        .string()
        .describe(
          'Describe the answer format and reference materials needed to complete this task; do not name an interface.',
        ),
      referenceMaterial: z
        .string()
        .describe(
          'All supporting evidence, data, and artifacts needed for this task. Empty if none. Keep facts consistent with the scenario and answer key.',
        ),
    });
