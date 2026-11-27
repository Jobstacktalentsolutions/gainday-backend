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
        'A short (1-2 sentence) summary of what this task would test, and the difficulty lever for the target seniority: the constraint, stakeholder or gap the candidate must handle.',
      ),
  });

export const candidatePoolSchema = (allowedTypeKeys: [string, ...string[]]) =>
  z.object({
    candidates: z.array(taskCandidateSchema(allowedTypeKeys)),
  });

// Pure ZodObject without ZodEffects (.refine()/.transform()) so strict Structured
// Outputs (Groq, Fireworks, OpenAI) can represent it directly in JSON Schema.
export const plannedSimulationSchema = (
  allowedTypeKeys: [string, ...string[]],
) =>
  z.object({
    candidates: z
      .array(taskCandidateSchema(allowedTypeKeys))
      .min(1)
      .describe('The planned candidate tasks for this simulation.'),
  });
