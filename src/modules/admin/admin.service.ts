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
import { RoleRegistry } from '../generation/roles/role-registry';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(EMBEDDINGS) private readonly embeddings: Embeddings,
    private readonly roleRegistry: RoleRegistry,
  ) {}

  /**
   * Flattened task-pattern-type definitions across every registered role module — lets the
   * frontend admin edit form know which objectiveComponentType/openEndedComponentType/
   * interfaceType applies to a given taskType without duplicating the role-module data client
   * side. Small, static-ish payload; safe to fetch once and cache.
   */
  listTaskPatternTypes() {
    return this.roleRegistry.getAllModules().flatMap((module) =>
      module.allowedTaskPatternTypes.map((patternType) => ({
        categoryKeys: module.categoryKeys,
        ...patternType,
      })),
    );
  }

  async getAdminStats() {
    const [
      [{ activeJobs }],
      [{ totalUsers }],
      [{ openSubmissions }],
      [{ jobsFilled }],
      recentJobsList,
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
        .where(eq(jobs.status, 'INACTIVE')),
      this.db.query.jobs.findMany({
        with: { employer: true },
        orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
        limit: 5,
      }),
    ]);

    const recentJobs = recentJobsList.map((j) => ({
      id: j.id,
      title: j.title || 'Untitled Role',
      company: j.employer?.companyName || 'Unknown Company',
      status: (j.status === 'ACTIVE' ? 'active' : 'pending') as
        | 'active'
        | 'pending',
    }));

    return {
      stats: {
        activeJobs,
        totalUsers,
        openSubmissions,
        jobsFilled,
      },
      recentJobs,
    };
  }

  async listUsers(role?: (typeof users.role.enumValues)[number]) {
    const userRows = await this.db.query.users.findMany({
      where: role ? eq(users.role, role) : undefined,
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });

    const [employerList, candidateList, adminList] = await Promise.all([
      this.db.query.employerProfiles.findMany({
        with: { jobs: true },
      }),
      this.db.query.jobSeekerProfiles.findMany({
        with: { submissions: true },
      }),
      this.db.query.adminProfiles.findMany(),
    ]);

    const employerMap = new Map(employerList.map((e) => [e.userId, e]));
    const candidateMap = new Map(candidateList.map((c) => [c.userId, c]));
    const adminMap = new Map(adminList.map((a) => [a.userId, a]));

    return userRows.map((user) => {
      if (user.role === 'EMPLOYER') {
        const emp = employerMap.get(user.id);
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          name: emp?.fullName || user.email.split('@')[0],
          status: (user.isActive ? 'active' : 'suspended') as
            | 'active'
            | 'suspended',
          employerProfile: {
            companyName: emp?.companyName || 'Not specified',
            isVerified: user.isEmailVerified,
            phoneNumber: emp?.phoneNumber,
            jobsCount: emp?.jobs?.length || 0,
          },
        };
      } else if (user.role === 'JOB_SEEKER') {
        const cand = candidateMap.get(user.id);
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          name: cand?.fullName || user.email.split('@')[0],
          status: (user.isActive ? 'active' : 'suspended') as
            | 'active'
            | 'suspended',
          candidateProfile: {
            phoneNumber: cand?.phoneNumber,
            submissionsCount: cand?.submissions?.length || 0,
          },
        };
      } else {
        const adm = adminMap.get(user.id);
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          name: adm?.fullName || 'Admin User',
          status: (user.isActive ? 'active' : 'suspended') as
            | 'active'
            | 'suspended',
        };
      }
    });
  }

  async listJobs() {
    const jobRows = await this.db.query.jobs.findMany({
      with: {
        employer: true,
        submissions: true,
        simulation: true,
      },
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    return jobRows.map((job) => ({
      id: job.id,
      title: job.title || 'Untitled Role',
      company: job.employer?.companyName || 'Unknown Company',
      status: (job.status === 'ACTIVE'
        ? 'live'
        : job.status === 'DRAFT'
          ? 'draft'
          : 'closed') as 'live' | 'draft' | 'closed',
      applicantCount: job.submissions?.length || 0,
      createdAt: job.createdAt,
      isSimulationReady: !!job.simulation,
      role: job.role,
      location: job.location,
    }));
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
    const [insertedQuestionBankRow] = await this.db
      .insert(questionBank)
      .values({
        category: reviewItem.category,
        intent: editedTaskContent.title,
        taskType: editedTaskContent.taskType,
        taskContent: editedTaskContent,
        sourceJobId: reviewItem.jobId,
        embedding,
      })
      .returning({ id: questionBank.id });

    const [simulation] = await this.db
      .select()
      .from(simulations)
      .where(eq(simulations.jobId, reviewItem.jobId));
    if (simulation) {
      const newTask: SimulationTask = {
        id: `${reviewItem.jobId}-review-${reviewItem.id}`,
        questionBankId: insertedQuestionBankRow.id,
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
   * Jobs with generation slots pending admin resolution currently stay ACTIVE
   * rather than being held at a separate review status (deferred for now).
   * This is a no-op placeholder retained for when that review-hold status
   * returns.
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
  }
}
