import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  jobs,
  Job,
  NewJob,
  SalaryRange,
  JobStatus,
  UserRole,
} from '../../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { JobBoardCacheService } from './job-board/job-board-cache.service';
import { countPendingTaskReviews } from '../generation/generation-review.util';
import { CreateJobDto } from './dto/create-job.dto';
import { SaveDraftJobDto } from './dto/save-draft-job.dto';
import { toSalaryBound } from './salary-bound.util';

type JobDetailsInput = CreateJobDto | SaveDraftJobDto;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly jobBoardCache: JobBoardCacheService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toJobValues(dto: JobDetailsInput): Partial<NewJob> {
    const values: Partial<NewJob> = {
      title: dto.title,
      role: dto.role,
      skillLevel: dto.skillLevel,
      location: dto.location,
      employmentType: dto.employmentType,
      isRemoteFriendly: dto.isRemoteFriendly,
      companyDescription: dto.companyDescription,
      requiredSkills: dto.skills,
      description: dto.description,
      businessProblem: dto.businessProblem,
    };

    if (dto.applicationDeadline !== undefined) {
      if (dto.applicationDeadline === null || dto.applicationDeadline === '') {
        values.applicationDeadline = null;
      } else {
        const deadline = new Date(dto.applicationDeadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isNaN(deadline.getTime()) || deadline.getTime() <= today.getTime()) {
          throw new BadRequestException(
            'Deadline must be greater than current day',
          );
        }
        values.applicationDeadline = deadline;
      }
    }

    if (dto.salaryFrom !== undefined || dto.salaryTo !== undefined) {
      const salaryRange: SalaryRange = {
        min: toSalaryBound(dto.salaryFrom),
        max: toSalaryBound(dto.salaryTo),
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

  /** Whether an employer's job has task slots still waiting on an admin, shown on the review page. */
  async getTaskReviewStatus(jobId: string, employerId: string) {
    const job = await this.findById(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.employerId !== employerId) {
      throw new ForbiddenException('You may only view your own jobs');
    }
    return { pendingCount: await countPendingTaskReviews(this.db, jobId) };
  }

  async publishJob(jobId: string): Promise<Job> {
    if ((await countPendingTaskReviews(this.db, jobId)) > 0) {
      throw new ConflictException(
        'Some tasks are still under admin review. The job can be published once they are resolved.',
      );
    }
    const existing = await this.db.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
      with: { employer: { with: { user: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Job not found');
    }

    const [job] = await this.db
      .update(jobs)
      .set({ status: 'ACTIVE', activatedAt: new Date(), updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    await this.jobBoardCache.invalidateAll();

    // Only the first move to live notifies the employer; re-publishing a live job stays quiet.
    if (existing.status !== 'ACTIVE') {
      await this.notifyEmployerJobLive(job, existing.employer.user.email);
    }
    return job;
  }

  /** Best-effort: a failed email must not undo a publish that already succeeded. */
  private async notifyEmployerJobLive(job: Job, employerEmail: string) {
    try {
      await this.notificationsService.sendJobLiveEmail(employerEmail, job);
    } catch (error) {
      this.logger.error(`Failed to send job live email for job ${job.id}`, error);
    }
  }

  /**
   * Employer-triggered: stops a live job taking applications and takes it off the job board.
   * Applications already made, and runs already in progress, are untouched. The status guard is
   * in the WHERE so only the owner's ACTIVE job can be closed.
   */
  async closeJob(jobId: string, employerId: string): Promise<Job> {
    const [job] = await this.db
      .update(jobs)
      .set({ status: 'CLOSED', updatedAt: new Date() })
      .where(
        and(
          eq(jobs.id, jobId),
          eq(jobs.employerId, employerId),
          eq(jobs.status, 'ACTIVE'),
        ),
      )
      .returning();
    if (!job) {
      throw new ConflictException('Only your live jobs can be closed');
    }
    return job;
  }

  async findAllActive() {
    return this.db.query.jobs.findMany({
      where: eq(jobs.status, 'ACTIVE'),
      with: { employer: true },
    });
  }

  async findById(id: string) {
    const job = await this.db.query.jobs.findFirst({
      where: eq(jobs.id, id),
      with: { employer: true },
    });
    return job ?? null;
  }

  async findByIdWithSimulation(id: string) {
    const job = await this.db.query.jobs.findFirst({
      where: eq(jobs.id, id),
      with: { simulation: true },
    });
    return job ?? null;
  }

  async findByEmployer(employerId: string, search?: string): Promise<Job[]> {
    const conditions = [eq(jobs.employerId, employerId)];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      conditions.push(or(ilike(jobs.title, s), ilike(jobs.role, s), ilike(jobs.location, s))!);
    }

    return this.db
      .select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.updatedAt));
  }

  async deleteJob(
    jobId: string,
    employerId: string,
    userRole?: string,
  ): Promise<{ success: boolean; message: string }> {
    const job = await this.findById(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (userRole !== UserRole.ADMIN && job.employerId !== employerId) {
      throw new ForbiddenException('You may only delete your own jobs');
    }

    if (job.status === JobStatus.ACTIVE) {
      throw new BadRequestException(
        'Live jobs cannot be deleted. Please close the job first.',
      );
    }

    await this.db.delete(jobs).where(eq(jobs.id, jobId));

    return {
      success: true,
      message: 'Job deleted successfully',
    };
  }
}
