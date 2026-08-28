import { z } from 'zod';

export const taskCandidateSchema = (allowedTypeKeys: [string, ...string[]]) =>
  z.object({
    candidateId: z
      .string()
      .describe('A short stable identifier for this candidate, e.g. "cand-1".'),
    taskType: z.enum(allowedTypeKeys),
    briefDescription: z
      .string()
      .describe(
        'A short (1-2 sentence) summary of what this candidate task would test.',
      ),
  });

export const candidatePoolSchema = (allowedTypeKeys: [string, ...string[]]) =>
  z.object({
    candidates: z.array(taskCandidateSchema(allowedTypeKeys)),
  });
