import { z } from 'zod';

const categoryAreaSchema = z.enum([
  'problemSolving',
  'judgmentExecution',
  'writtenCommunication',
  'commercialDomainAwareness',
  'OVERALL',
]);

export const passportNarrativeResultSchema = z.object({
  whatStoodOut: z
    .string()
    .describe(
      'One or two sentences, neutral voice (not addressed to "you") — shown to both the ' +
        'candidate and any employer viewing their passport.',
    ),
  improvementSuggestions: z
    .array(
      z.object({
        area: categoryAreaSchema,
        text: z
          .string()
          .describe(
            'One concise, constructive coaching sentence for this area.',
          ),
      }),
    )
    .min(1)
    .max(4)
    .describe(
      'Candidate-only — never shown to employers. At most one suggestion per category, plus ' +
        'at most one "OVERALL" suggestion.',
    ),
});

export type PassportNarrativeResultOutput = z.infer<
  typeof passportNarrativeResultSchema
>;
