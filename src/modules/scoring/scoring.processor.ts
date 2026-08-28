import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { jobs, submissions, jobExtractions } from '../../db/schema';
import { ScoringService } from './scoring.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

@Processor('scoring')
@Injectable()
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly scoringService: ScoringService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(bullJob: BullJob<{ jobId: string }>): Promise<any> {
    const { jobId } = bullJob.data;
    this.logger.log(`Processing batch scoring for Job ID: ${jobId}`);

    const job = await this.db.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
      with: { employer: true },
    });
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await this.db
      .update(jobs)
      .set({ status: 'UNDER_REVIEW', updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    const extraction = await this.db.query.jobExtractions.findFirst({
      where: eq(jobExtractions.jobId, jobId),
    });
    const capabilityDomain = extraction?.category ?? job.roleCategory;

    const pendingSubmissions = await this.db.query.submissions.findMany({
      where: and(
        eq(submissions.jobId, jobId),
        eq(submissions.status, 'PENDING'),
      ),
      with: { simulation: true, candidate: true },
    });

    this.logger.log(
      `Found ${pendingSubmissions.length} submissions to score for Job ID: ${jobId}`,
    );

    let processedCount = 0;
    for (const submission of pendingSubmissions) {
      try {
        await this.db
          .update(submissions)
          .set({ status: 'SCORING', updatedAt: new Date() })
          .where(eq(submissions.id, submission.id));

        const scoreResults =
          await this.scoringService.scoreSubmission(submission);
        const [updatedSubmission] = await this.db
          .update(submissions)
          .set({ ...scoreResults, updatedAt: new Date() })
          .where(eq(submissions.id, submission.id))
          .returning();

        if (updatedSubmission.candidateId && updatedSubmission.overallScore) {
          await this.usersService.updateUserCapabilityScores(
            updatedSubmission.candidateId,
            capabilityDomain,
            {
              score: updatedSubmission.overallScore,
              categories: {
                problemSolving:
                  updatedSubmission.categoryScores?.problemSolving?.score || 0,
                judgmentExecution:
                  updatedSubmission.categoryScores?.judgmentExecution?.score ||
                  0,
                writtenCommunication:
                  updatedSubmission.categoryScores?.writtenCommunication
                    ?.score || 0,
                commercialDomainAwareness:
                  updatedSubmission.categoryScores?.commercialDomainAwareness
                    ?.score || 0,
              },
            },
          );
        }

        const candidateEmail =
          submission.candidate?.email || submission.guestInfo?.email;
        if (candidateEmail && updatedSubmission.overallScore != null) {
          await this.notificationsService.sendScoringResultsEmail(
            candidateEmail,
            job.title,
            updatedSubmission.overallScore,
            updatedSubmission.categoryScores
              ? {
                  problemSolving:
                    updatedSubmission.categoryScores.problemSolving?.score || 0,
                  judgmentExecution:
                    updatedSubmission.categoryScores.judgmentExecution?.score ||
                    0,
                  writtenCommunication:
                    updatedSubmission.categoryScores.writtenCommunication
                      ?.score || 0,
                  commercialDomainAwareness:
                    updatedSubmission.categoryScores.commercialDomainAwareness
                      ?.score || 0,
                }
              : undefined,
          );
        }

        processedCount++;
      } catch (err) {
        this.logger.error(`Error scoring submission ${submission.id}:`, err);
      }
    }

    await this.db
      .update(jobs)
      .set({ status: 'SHORTLIST_READY', updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    if (job.employer?.email && processedCount > 0) {
      await this.notificationsService.sendBatchNotification(
        job.employer.email,
        processedCount,
        job.title,
      );
    }

    return { processedCount };
  }
}
