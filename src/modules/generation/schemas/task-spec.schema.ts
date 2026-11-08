import { z } from 'zod';
import { wordLimitSchema } from '../roles/interface-type';

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
    expectedDurationMinutes: z
      .number()
      .int()
      .min(2)
      .max(15)
      .describe(
        'Expected completion time in minutes for this task. The overall simulation has 4 tasks totaling at most 30 minutes (aim for 25-30 mins total).',
      ),
    wordLimit: wordLimitSchema,
    scenarioDescription: z.string().describe('GitHub-flavored Markdown. States no figures.'),
    questionPrompt: z
      .string()
      .describe(
        'GitHub-flavored Markdown. The requirements of the deliverable only. Never state word counts, limits, or length rules in the prompt text; the platform interface displays and enforces the word limit widget automatically. No tips.',
      ),
    businessProblemDerived: z.boolean(),
    data: dataSchema.describe(
      'The raw inputs the table and answer key are derived from. Every figure the candidate needs goes here.',
    ),
    openEndedComponent: openEndedComponentSchema
      ? openEndedComponentSchema
      : z.null().describe('This task type has no open-ended component.'),
  });
