import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { DRIZZLE } from '../../../db/db.constants';
import type { DrizzleDb } from '../../../db/client';
import {
  AnchorResponse,
  QuestionBankEntry,
  questionBank,
} from '../../../db/schema/question-bank.schema';
import { GRADING_MODEL, TASK_GENERATION_MODEL } from '../../ai/ai.constants';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';
import { GenerationConfig } from '../../generation/graph/generation-context';
import { anchorGenerationSchema } from '../schemas/anchor-generation.schema';
import { anchorCritiqueSchema } from '../schemas/anchor-critique.schema';
import { buildAnchorGenerationPrompt } from '../prompts/anchor-generation.prompt';
import { AnchorRoleRegistry } from '../roles/anchor-role-registry';
import { AnchorCriteriaFraming } from '../roles/anchor-role-config.interface';
import { GradingConfig } from '../grading.config.interface';

const logger = new Logger('Grading:anchorGeneration');

/**
 * Generates + critiques anchors for one question_bank row, per the generate -> critique loop
 * design (grading/ANCHOR_ARCHITECTURE.md, revived per updated product direction: a full
 * regenerate-and-recheck loop rather than the abandoned per-anchor self-correction variant).
 *
 * Called lazily from GradingService the first time a task's anchors are needed for grading — see
 * README.md's "when do anchors get generated" open question, resolved as: on first candidate
 * submission against a job, not eagerly after generation and not on a periodic batch.
 */
@Injectable()
export class AnchorGenerationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(TASK_GENERATION_MODEL)
    private readonly anchorGenerationModel: BaseChatModel,
    @Inject(GRADING_MODEL) private readonly anchorCriticModel: BaseChatModel,
    private readonly roleRegistry: AnchorRoleRegistry,
    private readonly configService: ConfigService,
  ) {}

  /** Returns the row's anchors, generating (and persisting) them first if missing. */
  async ensureAnchors(row: QuestionBankEntry): Promise<AnchorResponse[]> {
    if (row.anchors && row.anchors.length > 0) {
      return row.anchors;
    }

    logger.log(
      `No anchors yet for question_bank ${row.id} (category="${row.category}") — generating`,
    );

    const { anchors, needsReview } = await this.generateWithCritique(row);

    await this.db
      .update(questionBank)
      .set({ anchors, anchorsNeedReview: needsReview, updatedAt: new Date() })
      .where(eq(questionBank.id, row.id));

    if (needsReview) {
      logger.warn(
        `question_bank ${row.id}: anchor critic never approved anchors after the attempt cap — ` +
          `persisted the last attempt and flagged anchorsNeedReview for admin follow-up`,
      );
    } else {
      logger.log(`question_bank ${row.id}: anchors generated and approved`);
    }

    return anchors;
  }

  private async generateWithCritique(
    row: QuestionBankEntry,
  ): Promise<{ anchors: AnchorResponse[]; needsReview: boolean }> {
    const grading: GradingConfig = this.configService.getOrThrow('grading');
    const generation: GenerationConfig =
      this.configService.getOrThrow('generation');
    const roleConfig = this.roleRegistry.resolve(row.category);

    let lastAnchors: AnchorResponse[] | null = null;

    for (let attempt = 0; attempt < grading.maxAnchorAttempts; attempt++) {
      const anchors = await this.generateAnchors(
        row,
        roleConfig.criteriaFraming,
        generation.anchorScorePoints,
      );
      lastAnchors = anchors;

      const critique = await this.critiqueAnchors(
        row,
        anchors,
        roleConfig.anchorCorrectnessPrompt,
      );

      if (critique.sound) {
        return { anchors, needsReview: false };
      }

      logger.warn(
        `question_bank ${row.id}: anchor critique failed on attempt ${attempt + 1} of ` +
          `${grading.maxAnchorAttempts} — ${critique.reasons.join('; ') || 'no reasons given'}`,
      );
    }

    // Cap exhausted — conclude the anchors (or possibly the underlying task itself) couldn't be
    // made sound within budget. Persist the last attempt rather than blocking grading entirely.
    return { anchors: lastAnchors as AnchorResponse[], needsReview: true };
  }

  private async generateAnchors(
    row: QuestionBankEntry,
    criteriaFraming: AnchorCriteriaFraming,
    anchorScorePoints: number[],
  ): Promise<AnchorResponse[]> {
    const schema = anchorGenerationSchema(anchorScorePoints);
    const model = withGeminiSafeStructuredOutput(
      this.anchorGenerationModel,
      schema,
    );

    const result = await model.invoke([
      new SystemMessage(
        buildAnchorGenerationPrompt(criteriaFraming, anchorScorePoints),
      ),
      new HumanMessage(
        JSON.stringify({
          category: row.category,
          intent: row.intent,
          taskContent: row.taskContent,
        }),
      ),
    ]);

    return result.anchors;
  }

  private async critiqueAnchors(
    row: QuestionBankEntry,
    anchors: AnchorResponse[],
    anchorCorrectnessPrompt: string,
  ) {
    const model = withGeminiSafeStructuredOutput(
      this.anchorCriticModel,
      anchorCritiqueSchema,
    );

    return model.invoke([
      new SystemMessage(anchorCorrectnessPrompt),
      new HumanMessage(
        JSON.stringify({
          taskContent: row.taskContent,
          anchors,
        }),
      ),
    ]);
  }
}
