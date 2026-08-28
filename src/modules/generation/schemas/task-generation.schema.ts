import { z } from 'zod';

const anchorSchema = z.object({
  score: z
    .number()
    .describe(
      'One of the configured anchor score points, e.g. 0, 3, 5, 7, or 10.',
    ),
  responseText: z
    .string()
    .describe('A realistic candidate response that would earn this score.'),
  criteria: z.object({
    problemSolving: z.string(),
    judgmentExecution: z.string(),
    writtenCommunication: z.string(),
    commercialDomainAwareness: z.string(),
  }),
});

export const taskGenerationSchema = (allowedTypeKeys: [string, ...string[]]) =>
  z.object({
    taskType: z.enum(allowedTypeKeys),
    title: z.string(),
    scenarioDescription: z.string(),
    questionPrompt: z.string(),
    businessProblemDerived: z.boolean(),
    objectiveComponent: z.record(z.string(), z.unknown()).optional(),
    openEndedComponent: z.record(z.string(), z.unknown()).optional(),
    anchors: z
      .array(anchorSchema)
      .min(4)
      .describe(
        'At least 4-5 anchor points across the score range (e.g. 0, 3, 5, 7, 10) — not just the two poles. ' +
          'The top anchor should be strong but not implausibly perfect across all four criteria simultaneously; ' +
          'real strong answers trade off (e.g. commercially sharp but less polished prose).',
      ),
  });
