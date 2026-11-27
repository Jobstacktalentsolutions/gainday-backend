import { Logger } from '@nestjs/common';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
  CriticResult,
} from '../state/generation-state';
import {
  findSimilarQuestions,
  findSimilarSimulationQuestions,
} from '../critic/novelty-check';
import { checkForDuplicate } from '../critic/duplicate-check';
import { checkRelevance } from '../critic/relevance-check';
import { embedTaskContent } from '../utils/embedding.util';
import { findCsvProblem } from '../utils/csv.util';
import { InterfaceType } from '../roles/interface-type';
import { GeneratedTaskCandidate } from '../roles/role-module.interface';
import { taskLengthProblems } from '../utils/task-length.util';
import { questionRepeatsItems } from '../utils/objective-instruction.util';
import { slotBudgetMinutes } from '../utils/task-budget.util';

const logger = new Logger('GenerationPipeline:critic');

const DUPLICATE_SCENARIO_CHARS = 300;

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
    const [matches, simulationMatches] = await Promise.all([
      findSimilarQuestions(
        ctx.db,
        state.category,
        embedding,
        ctx.config.noveltyCheckTopK,
      ),
      findSimilarSimulationQuestions(
        ctx.db,
        state.finalizedTasks.map((task) => task.questionBankId),
        embedding,
      ),
    ]);
    const simulationDuplicate = checkForDuplicate(
      simulationMatches,
      ctx.config.sameSimulationSimilarityThreshold,
    );
    const bankDuplicate = checkForDuplicate(
      matches,
      ctx.config.duplicateSimilarityThreshold,
    );
    const duplicateResult = simulationDuplicate.isDuplicate
      ? simulationDuplicate
      : bankDuplicate;
    if (duplicateResult.isDuplicate) {
      // The retry sees the matched scenario, so it can write a different situation. The scenario is
      // cut short to keep the feedback small.
      const match = duplicateResult.closestMatch;
      const scenario = match?.scenario?.slice(0, DUPLICATE_SCENARIO_CHARS);
      failureReasons.push(
        `Duplicate: too similar to existing question_bank entry ${match?.id} (distance ${match?.distance})` +
          (scenario
            ? `. Write a different situation from this one: "${scenario}"`
            : '.'),
      );
    }
    logger.log(
      `Slot ${state.currentSlotIndex}: novelty check — ${matches.length} similar match(es) found` +
        (duplicateResult.closestMatch
          ? `, closest distance ${duplicateResult.closestMatch.distance.toFixed(4)}`
          : ''),
    );

    // Relevance check
    const patternDef = state.roleModule.allowedTaskPatternTypes.find(
      (p) => p.key === candidate.taskType,
    );
    const codeProblems = [
      ...taskLengthProblems(
        candidate.taskContent,
        patternDef?.objectiveComponentType,
        state.skillLevel,
        slotBudgetMinutes(ctx.config.selectedTaskCount),
      ),
      ...questionRepeatsItems(
        candidate.taskContent.questionPrompt,
        candidate.taskContent.objectiveComponent,
      ),
    ];
    failureReasons.push(...codeProblems);
    const relevanceResult = await checkRelevance(
      ctx.criticModel,
      candidate,
      {
        category: state.category,
        intent: state.intent,
        problem: state.problem,
        skillLevel: state.skillLevel ?? null,
      },
      patternDef?.objectiveComponentType,
    );
    if (!relevanceResult.relevant) {
      failureReasons.push(...relevanceResult.reasons);
    }
    failureReasons.push(...relevanceResult.presentationProblems);

    let additionalRelevanceOk = true;
    if (state.roleModule.criticChecks.additionalRelevanceCheck) {
      const additional =
        await state.roleModule.criticChecks.additionalRelevanceCheck(
          candidate,
          {
            category: state.category,
            intent: state.intent,
            problem: state.problem,
            skillLevel: state.skillLevel ?? null,
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
        codeProblems.length === 0 &&
        relevanceResult.presentationProblems.length === 0 &&
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
