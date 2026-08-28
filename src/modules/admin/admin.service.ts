import { Inject, Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import { DrizzleDb } from '../../db/client';
import { users, jobs, submissions } from '../../db/schema';

@Injectable()
export class AdminService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async getAdminStats() {
    const [[{ activeJobs }], [{ totalUsers }], [{ openSubmissions }], [{ jobsFilled }]] = await Promise.all([
      this.db.select({ activeJobs: count() }).from(jobs).where(eq(jobs.status, 'ACTIVE')),
      this.db.select({ totalUsers: count() }).from(users),
      this.db.select({ openSubmissions: count() }).from(submissions).where(eq(submissions.status, 'PENDING')),
      this.db.select({ jobsFilled: count() }).from(jobs).where(eq(jobs.status, 'CLOSED')),
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

  async reviewAntiCheatFlag(submissionId: string, action: 'UPHOLD' | 'OVERTURN') {
    const values =
      action === 'UPHOLD'
        ? {
            status: 'DISQUALIFIED' as const,
            disqualificationReason: 'Anti-cheat violation confirmed by admin review.',
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
}
