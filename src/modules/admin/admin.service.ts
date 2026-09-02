import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  users,
  jobs,
  submissions,
  simulations,
  questionBank,
  generationReviewItems,
  GenerationReviewStatus,
} from '../../db/schema';
import { QuestionBankTaskContent } from '../../db/schema/question-bank.schema';
import { SimulationTask } from '../../db/schema/simulations.schema';
import { EMBEDDINGS } from '../ai/ai.constants';
import { Embeddings } from '@langchain/core/embeddings';
import { embedTaskContent } from '../generation/utils/embedding.util';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(EMBEDDINGS) private readonly embeddings: Embeddings,
  ) {}

  async getAdminStats() {
    const [
      [{ activeJobs }],
      [{ totalUsers }],
      [{ openSubmissions }],
      [{ jobsFilled }],
    ] = await Promise.all([
      this.db
        .select({ activeJobs: count() })
        .from(jobs)
        .where(eq(jobs.status, 'ACTIVE')),
      this.db.select({ totalUsers: count() }).from(users),
      this.db
        .select({ openSubmissions: count() })
        .from(submissions)
        .where(eq(submissions.status, 'PENDING')),
      this.db
        .select({ jobsFilled: count() })
        .from(jobs)
        .where(eq(jobs.status, 'CLOSED')),
    ]);

    return { activeJobs, totalUsers, openSubmissions, jobsFilled };
  }

  async setUserActiveStatus(userId: string, isActive: boolean) {
    const [user] = await this.db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async reviewAntiCheatFlag(
    submissionId: string,
    action: 'UPHOLD' | 'OVERTURN',
  ) {
    const values =
      action === 'UPHOLD'
        ? {
            status: 'DISQUALIFIED' as const,
            disqualificationReason:
              'Anti-cheat violation confirmed by admin review.',
          }
        : {
            status: 'PENDING' as const,
            isAntiCheatFlagged: false,
          };

    const [submission] = await this.db
      .update(submissions)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(submissions.id, submissionId))
      .returning();
    if (!submission) {
      throw new Error('Submission not found');
    }
    return submission;
  }

  async deleteInappropriateJob(jobId: string): Promise<void> {
    await this.db.delete(jobs).where(eq(jobs.id, jobId));
  }

  async listGenerationReviewItems(status?: GenerationReviewStatus) {
    return this.db.query.generationReviewItems.findMany({
      where: status ? eq(generationReviewItems.status, status) : undefined,
      with: { job: true },
    });
  }

  async approveGenerationReviewWithEdits(
    reviewItemId: string,
    adminProfileId: string,
    editedTaskContent: QuestionBankTaskContent,
  ) {
    const [reviewItem] = await this.db
      .select()
      .from(generationReviewItems)
      .where(eq(generationReviewItems.id, reviewItemId));
    if (!reviewItem) {
      throw new Error('Generation review item not found');
    }

    const [updatedReviewItem] = await this.db
      .update(generationReviewItems)
      .set({
        status: 'APPROVED_WITH_EDITS',
        resolvedTaskContent: editedTaskContent,
        reviewedByAdminId: adminProfileId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(generationReviewItems.id, reviewItemId))
      .returning();

    const embedding = await embedTaskContent(
      this.embeddings,
      editedTaskContent,
    );
    await this.db.insert(questionBank).values({
      category: reviewItem.category,
      intent: editedTaskContent.title,
      taskType: editedTaskContent.taskType,
      taskContent: editedTaskContent,
      sourceJobId: reviewItem.jobId,
      embedding,
    });

    const [simulation] = await this.db
      .select()
      .from(simulations)
      .where(eq(simulations.jobId, reviewItem.jobId));
    if (simulation) {
      const newTask: SimulationTask = {
        id: `${reviewItem.jobId}-review-${reviewItem.id}`,
        taskType: editedTaskContent.taskType,
        category: reviewItem.category,
        title: editedTaskContent.title,
        scenarioDescription: editedTaskContent.scenarioDescription,
        questionPrompt: editedTaskContent.questionPrompt,
        objectiveComponent: editedTaskContent.objectiveComponent,
        openEndedComponent: editedTaskContent.openEndedComponent,
        businessProblemDerived: editedTaskContent.businessProblemDerived,
        interfaceType: editedTaskContent.interfaceType,
        interfacePayload: editedTaskContent.interfacePayload,
      };
      await this.db
        .update(simulations)
        .set({ tasks: [...simulation.tasks, newTask], updatedAt: new Date() })
        .where(eq(simulations.id, simulation.id));
    }

    await this.reactivateJobIfReviewComplete(reviewItem.jobId);

    return updatedReviewItem;
  }

  async rejectGenerationReview(reviewItemId: string, adminProfileId: string) {
    const [reviewItem] = await this.db
      .update(generationReviewItems)
      .set({
        status: 'REJECTED',
        reviewedByAdminId: adminProfileId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(generationReviewItems.id, reviewItemId))
      .returning();
    if (!reviewItem) {
      throw new Error('Generation review item not found');
    }

    await this.reactivateJobIfReviewComplete(reviewItem.jobId);

    return reviewItem;
  }

  /**
   * A job held at UNDER_REVIEW has one or more generation slots pending admin
   * resolution. Once every review item for that job has been approved or
   * rejected, the job can safely go ACTIVE again.
   */
  private async reactivateJobIfReviewComplete(jobId: string): Promise<void> {
    const [{ pendingCount }] = await this.db
      .select({ pendingCount: count() })
      .from(generationReviewItems)
      .where(
        and(
          eq(generationReviewItems.jobId, jobId),
          eq(generationReviewItems.status, 'PENDING'),
        ),
      );

    if (pendingCount > 0) {
      return;
    }

    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId));
    if (job?.status === 'UNDER_REVIEW') {
      await this.db
        .update(jobs)
        .set({ status: 'ACTIVE', updatedAt: new Date() })
        .where(eq(jobs.id, jobId));
    }
  }
}
