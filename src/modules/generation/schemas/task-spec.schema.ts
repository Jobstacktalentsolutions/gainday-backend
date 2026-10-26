import { z } from 'zod';

/**
 * Structured-output schema for a spec-backed task (see TaskSpecTemplate). The model writes the
 * text and the raw `data` inputs; the figures, table and answer key are derived from `data` in code.
 */
export const taskSpecSchema = (
  dataSchema: z.ZodType,
  openEndedComponentSchema: z.ZodTypeAny | null,
) =>
  z.object({
    title: z.string(),
    scenarioDescription: z.string().describe('GitHub-flavored Markdown. States no figures.'),
    questionPrompt: z
      .string()
      .describe(
        'GitHub-flavored Markdown. The deliverable, its recipient, format or length, and any content the work must include. No tips.',
      ),
    businessProblemDerived: z.boolean(),
    data: dataSchema.describe(
      'The raw inputs the table and answer key are derived from. Every figure the candidate needs goes here.',
    ),
    openEndedComponent: openEndedComponentSchema
      ? openEndedComponentSchema
      : z.null().describe('This task type has no open-ended component.'),
  });
