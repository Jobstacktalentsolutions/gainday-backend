import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  jobExtractions,
  generationReviewItems,
  jobs,
  users,
  employerProfiles,
  UserRole,
} from '../../db/schema';
import {
  GENERATION_MODEL,
  CRITIC_MODEL,
  TASK_GENERATION_MODEL,
  EMBEDDINGS,
} from '../ai/ai.constants';
import { GENERATION_QUEUE } from './generation.constants';
import { RoleRegistry } from './roles/role-registry';
import { buildGenerationGraph } from './graph/generation.graph';
import { GenerationConfig } from './graph/generation-context';
import { GenerationState } from './state/generation-state';
import { Job } from '../../db/schema';
import { SimulationTask } from '../../db/schema/simulations.schema';
import { TestGenerateDto } from './dto/test-generate.dto';

export interface GenerationResult {
  category: string;
  intent: string;
  problem: string | null;
  finalizedTasks: SimulationTask[];
  adminReviewItemsPersisted: number;
}

const TEST_EMPLOYER_EMAIL = 'pipeline-test@gainday.internal';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @InjectQueue(GENERATION_QUEUE) private readonly generationQueue: Queue,
    @Inject(GENERATION_MODEL) private readonly generationModel: BaseChatModel,
    @Inject(CRITIC_MODEL) private readonly criticModel: BaseChatModel,
    @Inject(TASK_GENERATION_MODEL)
    private readonly taskGenerationModel: BaseChatModel,
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
    this.logger.log(`Starting generation graph for Job ID ${job.id}`);
    const startedAt = Date.now();

    const config: GenerationConfig =
      this.configService.getOrThrow('generation');

    const graph = buildGenerationGraph({
      generationModel: this.generationModel,
      criticModel: this.criticModel,
      taskGenerationModel: this.taskGenerationModel,
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

    this.logger.log(
      `Graph invoke complete for Job ID ${job.id} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ` +
        `${finalState.finalizedTasks.length} finalized task(s), ${finalState.adminReviewItems.length} admin-review item(s)`,
    );

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
      }),
    );

    return {
      category: finalState.category,
      intent: finalState.intent,
      problem: finalState.problem,
      finalizedTasks,
      adminReviewItemsPersisted,
    };
  }

  /**
   * No-auth test entrypoint: creates a throwaway job (and a shared throwaway employer, if not
   * already present) from ad-hoc input, then runs the real generation pipeline against it —
   * exercises the actual persistence path (job_extractions, question_bank, admin review) rather
   * than a shortcut. Intended for local/manual pipeline testing only, not production traffic.
   */
  async runTestGeneration(dto: TestGenerateDto): Promise<GenerationResult> {
    let [testEmployer] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, TEST_EMPLOYER_EMAIL));

    let testEmployerProfile: typeof employerProfiles.$inferSelect | undefined;

    if (!testEmployer) {
      const created = await this.db.transaction(async (tx) => {
        const [newUser] = await tx
          .insert(users)
          .values({
            email: TEST_EMPLOYER_EMAIL,
            role: UserRole.EMPLOYER,
            authProvider: 'local',
            isEmailVerified: true,
          })
          .returning();

        const [newProfile] = await tx
          .insert(employerProfiles)
          .values({
            userId: newUser.id,
            fullName: 'Pipeline Test Employer',
            companyName: 'Pipeline Test Co',
          })
          .returning();

        return { newUser, newProfile };
      });
      testEmployer = created.newUser;
      testEmployerProfile = created.newProfile;
    } else {
      [testEmployerProfile] = await this.db
        .select()
        .from(employerProfiles)
        .where(eq(employerProfiles.userId, testEmployer.id));
    }

    if (!testEmployerProfile) {
      throw new Error('Test employer profile not found');
    }

    const [testJob] = await this.db
      .insert(jobs)
      .values({
        title: 'Pipeline Test Job',
        description: dto.description,
        requiredSkills: dto.requiredSkills ?? [],
        roleCategory: 'Unspecified',
        location: 'N/A',
        employmentType: 'N/A',
        salaryRange: { min: 0, max: 0, currency: 'USD' },
        applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        businessProblem: dto.businessProblem ?? '',
        status: 'GENERATING',
        employerId: testEmployerProfile.id,
      })
      .returning();

    this.logger.log(
      `Running test generation for throwaway Job ID ${testJob.id}`,
    );

    try {
      const result = await this.runGeneration(testJob);
      await this.db
        .update(jobs)
        .set({ status: 'ACTIVE', updatedAt: new Date() })
        .where(eq(jobs.id, testJob.id));
      return result;
    } catch (err) {
      await this.db
        .update(jobs)
        .set({ status: 'GENERATION_FAILED', updatedAt: new Date() })
        .where(eq(jobs.id, testJob.id));
      throw err;
    }
  }
}
