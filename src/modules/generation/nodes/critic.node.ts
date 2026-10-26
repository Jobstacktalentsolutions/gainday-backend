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
import { findCsvProblem } from '../utils/csv.util';
import { InterfaceType } from '../roles/interface-type';
import { GeneratedTaskCandidate } from '../roles/role-module.interface';

const logger = new Logger('GenerationPipeline:critic');

function failedWithoutContent(state: GenerationState): CriticResult {
  return {
    passed: false,
    failureReasons: state.draftProblems,
    noveltyDistance: null,
    isDuplicate: false,
    relevant: false,
    repairable: false,
    embedding: null,
  };
}

export function criticNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    const draft = state.currentTaskDraft;
    if (!draft) {
      throw new Error('critic node invoked with no currentTaskDraft in state');
    }
    if (!draft.taskContent) {
      return { currentCriticResult: failedWithoutContent(state) };
    }

    const candidate: GeneratedTaskCandidate = {
      taskType: draft.taskType,
      taskContent: draft.taskContent,
    };
    const failureReasons: string[] = [];

    // Novelty + duplicate check
    const embedding = await embedTaskContent(
      ctx.embeddings,
      candidate.taskContent,
    );
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
    const relevanceResult = await checkRelevance(ctx.criticModel, candidate, {
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
          candidate,
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

    // Tips are reported as one reason, so the repair step sees every sentence to reword. The fix
    // keeps the requirement the sentence carries and drops only the advice.
    const tips = relevanceResult.tipSentences;
    if (tips.length > 0) {
      failureReasons.push(
        `Tips in candidate text, reword as requirements of the work or remove the advice: ${tips.map((sentence) => `"${sentence}"`).join(' ')}`,
      );
    }

    // A data panel is only usable if its CSV can be shown as a table. The schema cannot say so
    // (strict Structured Outputs reject refinements), so it is checked here, and a failure
    // regenerates the slot like any other critic failure.
    let payloadValid = true;
    if (candidate.taskContent.interfaceType === InterfaceType.CSV_DATA_PANEL) {
      const csvProblem = findCsvProblem(
        (candidate.taskContent.interfacePayload as { csv: string }).csv,
      );
      if (csvProblem) {
        payloadValid = false;
        failureReasons.push(`Invalid data table: ${csvProblem}.`);
      }
    }

    const criticResult: CriticResult = {
      passed:
        payloadValid &&
        tips.length === 0 &&
        !duplicateResult.isDuplicate &&
        relevanceResult.relevant &&
        additionalRelevanceOk,
      failureReasons,
      noveltyDistance: duplicateResult.closestMatch?.distance ?? null,
      isDuplicate: duplicateResult.isDuplicate,
      relevant: relevanceResult.relevant && additionalRelevanceOk,
      repairable:
        !duplicateResult.isDuplicate &&
        relevanceResult.relevant &&
        additionalRelevanceOk,
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
