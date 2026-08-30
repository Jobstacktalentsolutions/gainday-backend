import { Logger } from '@nestjs/common';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
  CriticResult,
} from '../state/generation-state';
import { findSimilarQuestions } from '../critic/novelty-check';
import { checkForDuplicate } from '../critic/duplicate-check';
import { checkRelevance } from '../critic/relevance-check';
import { embedTaskContent } from '../utils/embedding.util';

const logger = new Logger('GenerationPipeline:critic');

export function criticNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    const draft = state.currentTaskDraft;
    if (!draft) {
      throw new Error('critic node invoked with no currentTaskDraft in state');
    }

    const failureReasons: string[] = [];

    // Novelty + duplicate check
    const embedding = await embedTaskContent(ctx.embeddings, draft.taskContent);
    const matches = await findSimilarQuestions(
      ctx.db,
      state.category,
      embedding,
      ctx.config.noveltyCheckTopK,
    );
    const duplicateResult = checkForDuplicate(
      matches,
      ctx.config.duplicateSimilarityThreshold,
    );
    if (duplicateResult.isDuplicate) {
      failureReasons.push(
        `Duplicate: too similar to existing question_bank entry ${duplicateResult.closestMatch?.id} (distance ${duplicateResult.closestMatch?.distance}).`,
      );
    }
    logger.log(
      `Slot ${state.currentSlotIndex}: novelty check — ${matches.length} similar match(es) found` +
        (duplicateResult.closestMatch
          ? `, closest distance ${duplicateResult.closestMatch.distance.toFixed(4)}`
          : ''),
    );

    // Relevance check
    const relevanceResult = await checkRelevance(ctx.criticModel, draft, {
      category: state.category,
      intent: state.intent,
      problem: state.problem,
    });
    if (!relevanceResult.relevant) {
      failureReasons.push(...relevanceResult.reasons);
    }

    let additionalRelevanceOk = true;
    if (state.roleModule.criticChecks.additionalRelevanceCheck) {
      const additional =
        await state.roleModule.criticChecks.additionalRelevanceCheck(
          draft,
          {
            category: state.category,
            intent: state.intent,
            problem: state.problem,
          },
          ctx.criticModel,
        );
      if (additional && !additional.relevant) {
        additionalRelevanceOk = false;
        failureReasons.push(...additional.reasons);
      }
    }

    const criticResult: CriticResult = {
      passed:
        !duplicateResult.isDuplicate &&
        relevanceResult.relevant &&
        additionalRelevanceOk,
      failureReasons,
      noveltyDistance: duplicateResult.closestMatch?.distance ?? null,
      isDuplicate: duplicateResult.isDuplicate,
      relevant: relevanceResult.relevant && additionalRelevanceOk,
      embedding,
    };

    logger.log(
      `Slot ${state.currentSlotIndex}: critic result — passed=${criticResult.passed}` +
        (failureReasons.length
          ? `, reasons: ${failureReasons.join('; ')}`
          : ''),
    );

    return { currentCriticResult: criticResult };
  };
}
