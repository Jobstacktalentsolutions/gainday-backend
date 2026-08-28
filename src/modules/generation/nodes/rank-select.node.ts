import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { judgeScoreSchema } from '../schemas/judge-score.schema';
import {
  TaskCandidateJudgeScore,
  TaskCandidateRecord,
} from '../../../db/schema/job-extractions.schema';

const JUDGE_PROMPT = `You are scoring a pool of candidate job-simulation tasks against an explicit
rubric. For each candidate, score:
- alignmentWithIntent (0-10): how well the candidate tests the stated Intent.
- alignmentWithCategory (0-10): how well the candidate fits the stated Category.
- problemIncorporationPotential (0-10, or null if no Problem was given): how well the candidate
  could meaningfully incorporate the stated business Problem.
Score every candidate provided. Do not omit any.`;

function computeComposite(score: {
  alignmentWithIntent: number;
  alignmentWithCategory: number;
  problemIncorporationPotential: number | null;
}): number {
  const values = [score.alignmentWithIntent, score.alignmentWithCategory];
  if (score.problemIncorporationPotential !== null) {
    values.push(score.problemIncorporationPotential);
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function rankSelectNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    const model =
      ctx.criticModel.withStructuredOutput<z.infer<typeof judgeScoreSchema>>(
        judgeScoreSchema,
      );

    const result = await model.invoke([
      new SystemMessage(JUDGE_PROMPT),
      new HumanMessage(
        JSON.stringify({
          category: state.category,
          intent: state.intent,
          problem: state.problem,
          candidates: state.candidatePool.map((c) => ({
            candidateId: c.candidateId,
            taskType: c.taskType,
            briefDescription: c.briefDescription,
          })),
        }),
      ),
    ]);

    const scoreByCandidateId = new Map(
      result.scores.map((s) => [s.candidateId, s]),
    );

    const scoredPool: TaskCandidateRecord[] = state.candidatePool.map(
      (candidate) => {
        const rawScore = scoreByCandidateId.get(candidate.candidateId);
        if (!rawScore) {
          return candidate;
        }
        const judgeScore: TaskCandidateJudgeScore = {
          alignmentWithIntent: rawScore.alignmentWithIntent,
          alignmentWithCategory: rawScore.alignmentWithCategory,
          problemIncorporationPotential: rawScore.problemIncorporationPotential,
          composite: computeComposite(rawScore),
        };
        return { ...candidate, judgeScore };
      },
    );

    const ranked = [...scoredPool].sort(
      (a, b) =>
        (b.judgeScore?.composite ?? -Infinity) -
        (a.judgeScore?.composite ?? -Infinity),
    );

    const selectedIds = new Set(
      ranked.slice(0, ctx.config.selectedTaskCount).map((c) => c.candidateId),
    );

    const candidatePool = scoredPool.map((c) => ({
      ...c,
      selected: selectedIds.has(c.candidateId),
    }));
    const selectedCandidates = candidatePool.filter((c) => c.selected);

    return { candidatePool, selectedCandidates };
  };
}
