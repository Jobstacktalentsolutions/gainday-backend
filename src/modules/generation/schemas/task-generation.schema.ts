import { z } from 'zod';

const anchorCriteriaSchema = z.object({
  problemSolving: z.string(),
  judgmentExecution: z.string(),
  writtenCommunication: z.string(),
  commercialDomainAwareness: z.string(),
});

/**
 * One anchor schema per configured score point, with the score itself fixed via z.literal
 * rather than left for the model to fill in — this is what forces exactly N anchors, one per
 * configured point, instead of letting the model guess a count or drift off the configured
 * points. `anchorScorePoints` comes from generationConfig (src/config/ai.config.ts).
 */
export const taskGenerationSchema = (
  allowedTypeKeys: [string, ...string[]],
  interfacePayloadSchema: z.ZodTypeAny,
  anchorScorePoints: number[],
  objectiveComponentSchema: z.ZodTypeAny | null,
  openEndedComponentSchema: z.ZodTypeAny | null,
) => {
  const anchorSchemas = anchorScorePoints.map((score) =>
    z.object({
      score: z
        .literal(score)
        .describe(`Fixed at ${score} — do not use any other value here.`),
      responseText: z
        .string()
        .describe('A realistic candidate response that would earn this score.'),
      criteria: anchorCriteriaSchema,
    }),
  );

  return z.object({
    taskType: z.enum(allowedTypeKeys),
    title: z.string(),
    scenarioDescription: z.string().describe('GitHub-flavored Markdown.'),
    questionPrompt: z.string().describe('GitHub-flavored Markdown.'),
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
    anchors: z
      .tuple(
        anchorSchemas as [
          (typeof anchorSchemas)[number],
          ...(typeof anchorSchemas)[number][],
        ],
      )
      .describe(
        `Exactly ${anchorScorePoints.length} anchors, one per configured score point (${anchorScorePoints.join(', ')}), in that order.`,
      ),
  });
};
