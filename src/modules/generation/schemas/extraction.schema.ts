import { z } from 'zod';

export const categoryExtractionSchema = z.object({
  category: z
    .string()
    .describe(
      'Domain and sub-domain of the role, e.g. "Finance > Reconciliation" or "Sales". Doubles as the router to the correct role module.',
    ),
});

export const intentProblemExtractionSchema = z.object({
  intent: z
    .string()
    .describe(
      'The skills and competencies the employer expects the hire to demonstrate.',
    ),
  problem: z
    .string()
    .nullable()
    .describe(
      'The specific business problem the employer describes wanting this hire to help solve, if stated in the input. Return null — never invent one — if no business problem is stated.',
    ),
});
