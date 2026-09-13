import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  submissions,
  questionBank,
  jobExtractions,
  TaskGradingResult,
} from '../../db/schema';
import { GRADING_QUEUE } from './grading.constants';
import { AnchorGenerationService } from './anchors/anchor-generation.service';
import { TaskGradingService } from './task-grading.service';
import { rollUpTaskScores } from './roll-up';
import { GradingConfig } from './grading.config.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { JobSeekerProfileService } from '../users/job-seeker-profile.service';

@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @InjectQueue(GRADING_QUEUE) private readonly gradingQueue: Queue,
    private readonly anchorGenerationService: AnchorGenerationService,
    private readonly taskGradingService: TaskGradingService,
    private readonly notificationsService: NotificationsService,
    private readonly jobSeekerProfileService: JobSeekerProfileService,
    private readonly configService: ConfigService,
  ) {}

  /** Enqueued from SubmissionsService.submitAnswers() — the actual anchor-generation-on-first-
   *  submission behavior falls naturally out of this being async and per-submission: the first
   *  submission against a job to reach a given task finds no anchors and generates them; every
   *  submission after that (for the same job) just finds them already there. */
  async queueGrading(submissionId: string): Promise<void> {
    this.logger.log(`Queueing grading for submission ${submissionId}`);
    await this.gradingQueue.add(
      'grade-submission',
      { submissionId },
      { jobId: `grade-${submissionId}` },
    );
  }

  async gradeSubmission(submissionId: string): Promise<void> {
    this.logger.log(`Starting grading for submission ${submissionId}`);

    const submission = await this.db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: {
        job: true,
        simulation: true,
        candidate: { with: { user: true } },
      },
    });
    if (!submission) {
      throw new Error(`Submission not found: ${submissionId}`);
    }
    if (!submission.simulation) {
      throw new Error(
        `Submission ${submissionId} has no linked simulation — cannot grade`,
      );
    }

    await this.db
      .update(submissions)
      .set({ status: 'SCORING', updatedAt: new Date() })
      .where(eq(submissions.id, submissionId));

    const tasksById = new Map(
      submission.simulation.tasks.map((t) => [t.id, t]),
    );
    const grading: GradingConfig = this.configService.getOrThrow('grading');

    const taskResults: TaskGradingResult[] = [];
    for (const answer of submission.answers) {
      const task = tasksById.get(answer.taskId);
      if (!task) {
        this.logger.warn(
          `Submission ${submissionId}: answer for unknown task ${answer.taskId} — skipping`,
        );
        continue;
      }
      if (!task.questionBankId) {
        // Task was added/regenerated via GenerationService.regenerateTask() but never accepted
        // into question_bank (see SimulationsService.updateSimulationTasks) — no row to attach
        // anchors to, so it cannot be graded yet.
        this.logger.warn(
          `Submission ${submissionId}: task ${task.id} has no question_bank row — skipping grading for it`,
        );
        continue;
      }

      const [row] = await this.db
        .select()
        .from(questionBank)
        .where(eq(questionBank.id, task.questionBankId));
      if (!row) {
        this.logger.warn(
          `Submission ${submissionId}: question_bank row ${task.questionBankId} not found — skipping task ${task.id}`,
        );
        continue;
      }

      const anchors = await this.anchorGenerationService.ensureAnchors(row);

      const result = await this.taskGradingService.gradeTask({
        category: row.category,
        taskTitle: task.title,
        scenarioDescription: task.scenarioDescription,
        questionPrompt: task.questionPrompt,
        anchors,
        candidateResponse: answer.responseBody,
      });

      taskResults.push({
        taskId: task.id,
        questionBankId: task.questionBankId,
        categoryScores: result.categoryScores,
        summary: result.summary,
      });
    }

    if (taskResults.length === 0) {
      this.logger.error(
        `Submission ${submissionId}: no tasks could be graded — reverting to PENDING`,
      );
      await this.db
        .update(submissions)
        .set({ status: 'PENDING', updatedAt: new Date() })
        .where(eq(submissions.id, submissionId));
      return;
    }

    const taskTitleById = new Map(
      Array.from(tasksById.values()).map((t) => [t.id, t.title]),
    );
    const { categoryScores, overallScore } = rollUpTaskScores(
      taskResults,
      taskTitleById,
      grading.categoryWeights,
    );

    const [updated] = await this.db
      .update(submissions)
      .set({
        status: 'SCORED',
        overallScore,
        categoryScores,
        taskScores: taskResults,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId))
      .returning();

    this.logger.log(
      `Submission ${submissionId} graded: overallScore=${overallScore}, ${taskResults.length} task(s)`,
    );

    if (updated.candidateId) {
      const [extraction] = await this.db
        .select()
        .from(jobExtractions)
        .where(eq(jobExtractions.jobId, updated.jobId));
      const capabilityDomain =
        extraction?.category ?? submission.job?.role ?? 'Unspecified';

      await this.jobSeekerProfileService.updateCapabilityScores(
        updated.candidateId,
        capabilityDomain,
        {
          score: overallScore,
          categories: {
            problemSolving: categoryScores.problemSolving.score,
            judgmentExecution: categoryScores.judgmentExecution.score,
            writtenCommunication: categoryScores.writtenCommunication.score,
            commercialDomainAwareness:
              categoryScores.commercialDomainAwareness.score,
          },
        },
      );
    }

    const candidateEmail =
      submission.candidate?.user?.email ?? submission.guestInfo?.email;
    if (candidateEmail) {
      await this.notificationsService.sendScoringResultsEmail(
        candidateEmail,
        submission.job?.title ?? 'Untitled role',
        overallScore,
        {
          problemSolving: categoryScores.problemSolving.score,
          judgmentExecution: categoryScores.judgmentExecution.score,
          writtenCommunication: categoryScores.writtenCommunication.score,
          commercialDomainAwareness:
            categoryScores.commercialDomainAwareness.score,
        },
        taskResults.map((t) => ({
          title: taskTitleById.get(t.taskId) ?? 'Task',
          summary: t.summary,
        })),
      );
    }
  }
}
