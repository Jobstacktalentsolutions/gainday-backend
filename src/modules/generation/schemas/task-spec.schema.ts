import { z } from 'zod';
import { wordLimitSchema, writtenWordLimitSchema } from '../roles/interface-type';

/**
 * Structured-output schema for a spec-backed task (see TaskSpecTemplate). The model writes the
 * text and the raw `data` inputs; the figures, table and answer key are derived from `data` in code.
 */
export const taskSpecSchema = (
  dataSchema: z.ZodType,
  openEndedComponentSchema: z.ZodTypeAny | null,
  requireWordLimit = false,
) =>
  z.object({
    title: z.string(),
    expectedDurationMinutes: z
      .number()
      .int()
      .min(2)
      .max(15)
      .describe(
        'Whole minutes the candidate needs, reading and answering. Never more than the task time budget.',
      ),
    wordLimit: requireWordLimit ? writtenWordLimitSchema : wordLimitSchema,
    scenarioDescription: z
      .string()
      .describe('GitHub-flavored Markdown. States no figures.'),
    questionPrompt: z
      .string()
      .describe(
        'GitHub-flavored Markdown. The requirements of the deliverable only: one deliverable, at most 3 requirements. Never state word counts, limits, or length rules; the platform shows the word limit. No tips.',
      ),
    businessProblemDerived: z.boolean(),
    data: dataSchema.describe(
      'The raw inputs the table and answer key are derived from. Every figure the candidate needs goes here.',
    ),
    openEndedComponent: openEndedComponentSchema
      ? openEndedComponentSchema
      : z.null().describe('This task type has no open-ended component.'),
  });
