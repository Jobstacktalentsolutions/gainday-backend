import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { submissions, CandidateAnswer } from '../../db/schema';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @InjectQueue('scoring') private readonly scoringQueue: Queue,
  ) {}

  async createSubmission(
    jobId: string,
    simulationId: string,
    candidateId?: string,
    guestInfo?: { fullName: string; email: string; phoneNumber?: string },
  ) {
    const [submission] = await this.db
      .insert(submissions)
      .values({
        jobId,
        simulationId,
        candidateId,
        guestInfo,
        status: 'PENDING',
        startedAt: new Date(),
        answers: [],
      })
      .returning();
    return submission;
  }

  async submitAnswers(submissionId: string, answers: CandidateAnswer[]) {
    const submission = await this.db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
    });
    if (!submission) {
      throw new Error('Submission not found');
    }

    const completedAt = new Date();
    const timeTakenSeconds = Math.floor(
      (completedAt.getTime() -
        (submission.startedAt?.getTime() || completedAt.getTime())) /
        1000,
    );

    const [updated] = await this.db
      .update(submissions)
      .set({ answers, completedAt, timeTakenSeconds, updatedAt: new Date() })
      .where(eq(submissions.id, submissionId))
      .returning();

    return updated;
  }

  async queueBatchScoring(jobId: string, delayMs: number): Promise<void> {
    this.logger.log(
      `Queueing batch scoring for Job ID ${jobId} in ${delayMs}ms`,
    );
    await this.scoringQueue.add(
      'batch-score-job',
      { jobId },
      { delay: delayMs, jobId: `batch-score-${jobId}` },
    );
  }

  async findByJob(jobId: string) {
    return this.db.query.submissions.findMany({
      where: eq(submissions.jobId, jobId),
      with: { candidate: true },
    });
  }

  async findById(id: string) {
    const submission = await this.db.query.submissions.findFirst({
      where: eq(submissions.id, id),
      with: { job: true, simulation: true, candidate: true },
    });
    return submission ?? null;
  }

  async unlockCandidate(submissionId: string) {
    const [submission] = await this.db
      .update(submissions)
      .set({ isUnlocked: true, updatedAt: new Date() })
      .where(eq(submissions.id, submissionId))
      .returning();
    if (!submission) {
      throw new Error('Submission not found');
    }
    return submission;
  }

  async findPendingByJob(jobId: string) {
    return this.db.query.submissions.findMany({
      where: and(
        eq(submissions.jobId, jobId),
        eq(submissions.status, 'PENDING'),
      ),
      with: { simulation: true },
    });
  }

  async updateStatus(
    submissionId: string,
    status: (typeof submissions.$inferSelect)['status'],
  ) {
    const [submission] = await this.db
      .update(submissions)
      .set({ status, updatedAt: new Date() })
      .where(eq(submissions.id, submissionId))
      .returning();
    return submission;
  }

  async saveScoringResult(
    submissionId: string,
    scoreResults: Record<string, unknown>,
  ) {
    const [submission] = await this.db
      .update(submissions)
      .set({ ...scoreResults, updatedAt: new Date() })
      .where(eq(submissions.id, submissionId))
      .returning();
    return submission;
  }
}
