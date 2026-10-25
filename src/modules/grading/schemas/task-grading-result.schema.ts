import { z } from 'zod';
import type { TaskRubric } from '../../../db/schema/question-bank.schema';

export const GRADED_CRITERIA = [
  'problemSolving',
  'judgmentExecution',
  'writtenCommunication',
  'commercialDomainAwareness',
] as const;
export type GradedCriterion = (typeof GRADED_CRITERIA)[number];

// Whole numbers 0-100, on the same scale as the anchor score points (anchorScorePoints in
// ai.config.ts) and the submission-level overallScore — see roll-up.ts.
const categoryScoreDetailSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.string(),
  evidence: z.string(),
});

const checklistMarkSchema = z.object({
  met: z.boolean(),
  evidence: z.string().describe('A short quote or paraphrase from the response, or "" if not met.'),
});

/**
 * The LLM grader's output for the criteria it owns, plus rubric checks when the task has them. A
 * task whose objective part is checked in code asks for only the open-ended criteria, so the model
 * never scores what the answer key already settled.
 */
export function buildTaskGradingResultSchema(
  criteria: readonly GradedCriterion[],
  rubric: TaskRubric | undefined,
): z.ZodType<LlmGradeOutput> {
  const categoryShape = Object.fromEntries(
    criteria.map((criterion) => [criterion, categoryScoreDetailSchema]),
  ) as Record<GradedCriterion, typeof categoryScoreDetailSchema>;

  const rubricShape: z.ZodRawShape =
    rubric && rubric.checklist.length > 0
      ? {
          checklist: z
            .array(checklistMarkSchema)
            .describe('One entry per checklist item, in the order given.'),
        }
      : {};
  const gateShape: z.ZodRawShape =
    rubric && rubric.gate !== null ? { gateTriggered: z.boolean() } : {};

  return z.object({
    categoryScores: z.object(categoryShape),
    summary: z
      .string()
      .describe(
        'One or two concise, candidate-facing sentences explaining why they received this ' +
          'score on this specific task — shown/emailed directly to the candidate, so write it ' +
          'to them directly ("You..."), not about them in the third person.',
      ),
    ...rubricShape,
    ...gateShape,
  }) as z.ZodType<LlmGradeOutput>;
}

export type LlmCategoryScores = Partial<
  Record<GradedCriterion, z.infer<typeof categoryScoreDetailSchema>>
>;

export interface LlmRubricResult {
  checklist?: z.infer<typeof checklistMarkSchema>[];
  gateTriggered?: boolean;
}

export interface LlmGradeOutput extends LlmRubricResult {
  categoryScores: LlmCategoryScores;
  summary: string;
}
