import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { jobs, Job, NewJob } from '../../db/schema';

@Injectable()
export class JobsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async createJob(employerId: string, jobData: Partial<NewJob>): Promise<Job> {
    const [job] = await this.db
      .insert(jobs)
      .values({ ...jobData, employerId, status: 'DRAFT' } as NewJob)
      .returning();
    return job;
  }

  async publishJob(jobId: string): Promise<Job> {
    const [job] = await this.db
      .update(jobs)
      .set({ status: 'ACTIVE', updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();
    if (!job) {
      throw new Error('Job not found');
    }
    return job;
  }

  async findAllActive(): Promise<Job[]> {
    return this.db.select().from(jobs).where(eq(jobs.status, 'ACTIVE'));
  }

  async findById(id: string): Promise<Job | null> {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, id));
    return job ?? null;
  }

  async findByEmployer(employerId: string): Promise<Job[]> {
    return this.db.select().from(jobs).where(eq(jobs.employerId, employerId));
  }
}
