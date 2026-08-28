import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { jobExtractions, generationReviewItems } from '../../db/schema';
import { GENERATION_MODEL, CRITIC_MODEL, EMBEDDINGS } from '../ai/ai.constants';
import { GENERATION_QUEUE } from './generation.constants';
import { RoleRegistry } from './roles/role-registry';
import { buildGenerationGraph } from './graph/generation.graph';
import { GenerationConfig } from './graph/generation-context';
import { GenerationState } from './state/generation-state';
import { Job } from '../../db/schema';
import { SimulationTask } from '../../db/schema/simulations.schema';

export interface GenerationResult {
  finalizedTasks: SimulationTask[];
  adminReviewItemsPersisted: number;
}

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @InjectQueue(GENERATION_QUEUE) private readonly generationQueue: Queue,
    @Inject(GENERATION_MODEL) private readonly generationModel: BaseChatModel,
    @Inject(CRITIC_MODEL) private readonly criticModel: BaseChatModel,
    @Inject(EMBEDDINGS) private readonly embeddings: Embeddings,
    private readonly roleRegistry: RoleRegistry,
    private readonly configService: ConfigService,
  ) {}

  async queueGeneration(jobId: string): Promise<void> {
    this.logger.log(`Queueing simulation generation for Job ID ${jobId}`);
    await this.generationQueue.add(
      'generate-simulation',
      { jobId },
      { jobId: `generate-${jobId}` },
    );
  }

  /**
   * Runs the compiled LangGraph pipeline for a job and persists the resulting extraction,
   * simulation tasks, and any admin-review items. Called by GenerationProcessor.
   */
  async runGeneration(job: Job): Promise<GenerationResult> {
    const config: GenerationConfig =
      this.configService.getOrThrow('generation');

    const graph = buildGenerationGraph({
      generationModel: this.generationModel,
      criticModel: this.criticModel,
      embeddings: this.embeddings,
      db: this.db,
      roleRegistry: this.roleRegistry,
      config,
    });

    const initialState: Partial<GenerationState> = {
      jobId: job.id,
      jobDescription: job.description,
      requiredSkills: job.requiredSkills,
      businessProblemRaw: job.businessProblem || undefined,
    };

    const finalState = await graph.invoke(initialState);

    await this.db
      .insert(jobExtractions)
      .values({
        jobId: job.id,
        category: finalState.category,
        intent: finalState.intent,
        problem: finalState.problem,
        candidatePool: finalState.candidatePool,
      })
      .onConflictDoUpdate({
        target: jobExtractions.jobId,
        set: {
          category: finalState.category,
          intent: finalState.intent,
          problem: finalState.problem,
          candidatePool: finalState.candidatePool,
          updatedAt: new Date(),
        },
      });

    let adminReviewItemsPersisted = 0;
    for (const item of finalState.adminReviewItems) {
      await this.db.insert(generationReviewItems).values({
        jobId: job.id,
        slotIndex: item.slotIndex,
        category: item.category,
        attempts: item.attempts,
      });
      adminReviewItemsPersisted++;
    }

    const finalizedTasks: SimulationTask[] = finalState.finalizedTasks.map(
      (task, index) => ({
        id: `${job.id}-task-${index + 1}`,
        taskType: task.taskType,
        category: finalState.category,
        title: task.taskContent.title,
        scenarioDescription: task.taskContent.scenarioDescription,
        questionPrompt: task.taskContent.questionPrompt,
        objectiveComponent: task.taskContent.objectiveComponent,
        openEndedComponent: task.taskContent.openEndedComponent,
        businessProblemDerived: task.taskContent.businessProblemDerived,
        interfaceType: task.taskContent.interfaceType,
        interfacePayload: task.taskContent.interfacePayload,
        anchors: task.anchors,
      }),
    );

    return { finalizedTasks, adminReviewItemsPersisted };
  }
}
