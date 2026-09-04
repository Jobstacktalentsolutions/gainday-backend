import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { jobs, Job, NewJob, SalaryRange } from '../../db/schema';
import { CreateJobDto } from './dto/create-job.dto';
import { SaveDraftJobDto } from './dto/save-draft-job.dto';

type JobDetailsInput = CreateJobDto | SaveDraftJobDto;

@Injectable()
export class JobsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  private toJobValues(dto: JobDetailsInput): Partial<NewJob> {
    const values: Partial<NewJob> = {
      title: dto.title,
      role: dto.role,
      skillLevel: dto.skillLevel,
      skillCategory: dto.skillCategory,
      location: dto.location,
      employmentType: dto.employmentType,
      isRemoteFriendly: dto.isRemoteFriendly,
      companyDescription: dto.companyDescription,
      requiredSkills: dto.skills,
      description: dto.description,
      businessProblem: dto.description,
    };

    if (dto.applicationDeadline !== undefined) {
      values.applicationDeadline = new Date(dto.applicationDeadline);
    }

    if (dto.salaryFrom !== undefined || dto.salaryTo !== undefined) {
      const salaryRange: SalaryRange = {
        min: dto.salaryFrom ?? null,
        max: dto.salaryTo ?? null,
        currency: 'GBP',
      };
      values.salaryRange = salaryRange;
    }

    // Strip undefined keys so a partial draft update doesn't clobber
    // previously saved fields with undefined.
    return Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== undefined),
    );
  }

  async saveDraft(
    employerId: string,
    dto: SaveDraftJobDto,
    jobId?: string,
  ): Promise<Job> {
    const values = this.toJobValues(dto);

    if (jobId) {
      const [job] = await this.db
        .update(jobs)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(jobs.id, jobId), eq(jobs.employerId, employerId)))
        .returning();
      if (!job) {
        throw new NotFoundException('Job not found');
      }
      return job;
    }

    const [job] = await this.db
      .insert(jobs)
      .values({ ...values, employerId, status: 'DRAFT' } as NewJob)
      .returning();
    return job;
  }

  async saveDetails(
    employerId: string,
    dto: CreateJobDto,
    jobId?: string,
  ): Promise<Job> {
    return this.saveDraft(employerId, dto, jobId);
  }

  async publishJob(jobId: string): Promise<Job> {
    const [job] = await this.db
      .update(jobs)
      .set({ status: 'ACTIVE', updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();
    if (!job) {
      throw new NotFoundException('Job not found');
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
    return this.db
      .select()
      .from(jobs)
      .where(eq(jobs.employerId, employerId))
      .orderBy(desc(jobs.updatedAt));
  }
}
