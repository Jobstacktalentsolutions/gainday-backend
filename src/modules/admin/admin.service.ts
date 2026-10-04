import {
  Inject,
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq, or, ilike, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  users,
  adminProfiles,
  jobSeekerProfiles,
  employerProfiles,
  jobs,
  submissions,
  simulations,
  questionBank,
  generationReviewItems,
  GenerationReviewStatus,
} from '../../db/schema';
import { CreateAdminDto } from './dto/create-admin.dto';
import {
  ListUsersQueryDto,
  ListJobsQueryDto,
  ListGenerationReviewsQueryDto,
} from './dto/pagination-query.dto';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}
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

  async getAdminStats(
    timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'month',
  ) {
    const [
      [{ activeJobs }],
      [{ totalUsers }],
      [{ employersCount }],
      [{ candidatesCount }],
      [{ totalSubmissions }],
      [{ openSubmissions }],
      [{ scoredSubmissions }],
      [{ jobsFilled }],
      [{ flaggedAntiCheatCount }],
      [{ pendingReviewsCount }],
      recentJobsList,
      candidateRegistrations,
      allSubmissions,
    ] = await Promise.all([
      this.db
        .select({ activeJobs: count() })
        .from(jobs)
        .where(eq(jobs.status, 'ACTIVE')),
      this.db.select({ totalUsers: count() }).from(users),
      this.db
        .select({ employersCount: count() })
        .from(users)
        .where(eq(users.role, 'EMPLOYER')),
      this.db
        .select({ candidatesCount: count() })
        .from(users)
        .where(eq(users.role, 'JOB_SEEKER')),
      this.db.select({ totalSubmissions: count() }).from(submissions),
      this.db
        .select({ openSubmissions: count() })
        .from(submissions)
        .where(eq(submissions.status, 'PENDING')),
      this.db
        .select({ scoredSubmissions: count() })
        .from(submissions)
        .where(eq(submissions.status, 'SCORED')),
      this.db
        .select({ jobsFilled: count() })
        .from(jobs)
        .where(eq(jobs.status, 'INACTIVE')),
      this.db
        .select({ flaggedAntiCheatCount: count() })
        .from(submissions)
        .where(
          or(
            eq(submissions.isAntiCheatFlagged, true),
            eq(submissions.status, 'DISQUALIFIED'),
          ),
        ),
      this.db
        .select({ pendingReviewsCount: count() })
        .from(generationReviewItems)
        .where(eq(generationReviewItems.status, 'PENDING')),
      this.db.query.jobs.findMany({
        with: { employer: true, submissions: true },
        orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
        limit: 6,
      }),
      this.db
        .select({ createdAt: users.createdAt })
        .from(users)
        .where(eq(users.role, 'JOB_SEEKER')),
      this.db
        .select({ createdAt: submissions.createdAt })
        .from(submissions),
    ]);

    const recentJobs = recentJobsList.map((j) => ({
      id: j.id,
      title: j.title || 'Untitled Role',
      company: j.employer?.companyName || 'Unknown Company',
      applicantsCount: j.submissions?.length || 0,
      status: (j.status === 'ACTIVE' ? 'active' : 'pending') as
        | 'active'
        | 'pending',
    }));

    const analytics = this.buildAnalyticsSeries(
      timeframe,
      candidateRegistrations.map((r) => r.createdAt),
      allSubmissions.map((s) => s.createdAt),
    );

    return {
      stats: {
        activeJobs,
        totalUsers,
        employersCount,
        candidatesCount,
        totalSubmissions,
        openSubmissions,
        scoredSubmissions,
        jobsFilled,
        flaggedAntiCheatCount,
        pendingReviewsCount,
      },
      analytics,
      timeframe,
      recentJobs,
    };
  }

  private buildAnalyticsSeries(
    timeframe: 'day' | 'week' | 'month' | 'year' | 'all',
    appDates: (Date | string | null)[],
    subDates: (Date | string | null)[],
  ) {
    const now = new Date();
    const buckets: {
      key: string;
      label: string;
      startTime: number;
      endTime: number;
      applications: number;
      submissions: number;
    }[] = [];

    if (timeframe === 'day') {
      // 24 hourly buckets
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0).getTime();
        const end = start + 60 * 60 * 1000;
        const hourStr = `${d.getHours().toString().padStart(2, '0')}:00`;
        buckets.push({
          key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`,
          label: hourStr,
          startTime: start,
          endTime: end,
          applications: 0,
          submissions: 0,
        });
      }
    } else if (timeframe === 'week') {
      // 7 daily buckets
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).getTime();
        const end = start + 24 * 60 * 60 * 1000;
        const label = `${dayNames[d.getDay()]} ${d.getDate()}`;
        buckets.push({
          key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
          label,
          startTime: start,
          endTime: end,
          applications: 0,
          submissions: 0,
        });
      }
    } else if (timeframe === 'month') {
      // 30 daily buckets (or 15 two-day steps)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).getTime();
        const end = start + 24 * 60 * 60 * 1000;
        const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;
        buckets.push({
          key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
          label,
          startTime: start,
          endTime: end,
          applications: 0,
          submissions: 0,
        });
      }
    } else if (timeframe === 'year' || timeframe === 'all') {
      // 12 monthly buckets
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthsCount = timeframe === 'all' ? 12 : 12;
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = d.getTime();
        const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const end = nextMonth.getTime();
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
        buckets.push({
          key: `${d.getFullYear()}-${d.getMonth()}`,
          label,
          startTime: start,
          endTime: end,
          applications: 0,
          submissions: 0,
        });
      }
    }

    // Populate applications
    for (const rawDate of appDates) {
      if (!rawDate) continue;
      const t = new Date(rawDate).getTime();
      const bucket = buckets.find((b) => t >= b.startTime && t < b.endTime);
      if (bucket) {
        bucket.applications += 1;
      }
    }

    // Populate submissions
    for (const rawDate of subDates) {
      if (!rawDate) continue;
      const t = new Date(rawDate).getTime();
      const bucket = buckets.find((b) => t >= b.startTime && t < b.endTime);
      if (bucket) {
        bucket.submissions += 1;
      }
    }

    return buckets.map((b) => ({
      label: b.label,
      applications: b.applications,
      submissions: b.submissions,
      total: b.applications + b.submissions,
    }));
  }

  async listUsers(
    query: ListUsersQueryDto = {},
  ): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (query.role) {
      conditions.push(eq(users.role, query.role));
    }
    if (query.status === 'active') {
      conditions.push(eq(users.isActive, true));
    } else if (query.status === 'suspended') {
      conditions.push(eq(users.isActive, false));
    }
    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(ilike(users.email, s));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [[{ total }], userRows] = await Promise.all([
      this.db.select({ total: count() }).from(users).where(whereClause),
      this.db.query.users.findMany({
        where: whereClause,
        orderBy: (users, { desc }) => [desc(users.createdAt)],
        limit,
        offset,
      }),
    ]);

    const totalCount = Number(total) || 0;
    const totalPages = Math.ceil(totalCount / limit);
    const userIds = userRows.map((u) => u.id);

    let employerList: any[] = [];
    let candidateList: any[] = [];
    let adminList: any[] = [];

    if (userIds.length > 0) {
      [employerList, candidateList, adminList] = await Promise.all([
        this.db.query.employerProfiles.findMany({
          where: inArray(employerProfiles.userId, userIds),
          with: { jobs: true },
        }),
        this.db.query.jobSeekerProfiles.findMany({
          where: inArray(jobSeekerProfiles.userId, userIds),
          with: { submissions: true },
        }),
        this.db.query.adminProfiles.findMany({
          where: inArray(adminProfiles.userId, userIds),
        }),
      ]);
    }

    const employerMap = new Map(employerList.map((e) => [e.userId, e]));
    const candidateMap = new Map(candidateList.map((c) => [c.userId, c]));
    const adminMap = new Map(adminList.map((a) => [a.userId, a]));

    const items = userRows.map((user) => {
      if (user.role === 'EMPLOYER') {
        const emp = employerMap.get(user.id);
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          suspensionReason: user.suspensionReason,
          suspendedAt: user.suspendedAt,
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
          suspensionReason: user.suspensionReason,
          suspendedAt: user.suspendedAt,
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
        const isSuperAdmin =
          user.email === process.env.ADMIN_EMAIL ||
          user.email === 'admin@gainday.com' ||
          user.email === 'enweremproper@gmail.com';
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          suspensionReason: user.suspensionReason,
          suspendedAt: user.suspendedAt,
          createdAt: user.createdAt,
          name: adm?.fullName || 'Admin User',
          status: (user.isActive ? 'active' : 'suspended') as
            | 'active'
            | 'suspended',
          adminProfile: {
            fullName: adm?.fullName || 'Admin User',
            adminRole: isSuperAdmin ? 'SUPER_ADMIN' : 'MANAGER',
            isSuperAdmin,
          },
        };
      }
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async createAdmin(dto: CreateAdminDto) {
    if ((dto.role as string) === 'SUPER_ADMIN') {
      throw new BadRequestException(
        'A Super Admin cannot be created from the dashboard. There is strictly one Super Admin, configured via system environment.',
      );
    }

    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase().trim()),
    });
    if (existing) {
      throw new ConflictException(
        'A user with this email address already exists',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const [newUser] = await this.db
      .insert(users)
      .values({
        email: dto.email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'ADMIN',
        authProvider: 'local',
        isEmailVerified: true,
        isActive: true,
      })
      .returning();

    const [newProfile] = await this.db
      .insert(adminProfiles)
      .values({
        userId: newUser.id,
        fullName: dto.fullName.trim(),
      })
      .returning();

    return {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      createdAt: newUser.createdAt,
      name: newProfile.fullName,
      status: 'active' as const,
      adminProfile: {
        fullName: newProfile.fullName,
        adminRole: dto.role || 'MANAGER',
        isSuperAdmin: false,
      },
    };
  }

  async deleteAdmin(userId: string, currentAdminId?: string) {
    if (currentAdminId && userId === currentAdminId) {
      throw new BadRequestException('You cannot delete your own admin account');
    }

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user || user.role !== 'ADMIN') {
      throw new NotFoundException('Admin user not found');
    }

    const isSuperAdmin =
      user.email === process.env.ADMIN_EMAIL ||
      user.email === 'enweremproper@gmail.com';

    if (isSuperAdmin) {
      throw new BadRequestException(
        'The Super Admin account cannot be deleted directly from the dashboard.',
      );
    }

    await this.db.delete(users).where(eq(users.id, userId));
    return { success: true, message: 'Admin deleted successfully' };
  }

  async listJobs(
    query: ListJobsQueryDto = {},
  ): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (query.status) {
      const normalized = query.status.toUpperCase();
      if (normalized === 'LIVE' || normalized === 'ACTIVE') {
        conditions.push(eq(jobs.status, 'ACTIVE'));
      } else if (normalized === 'DRAFT') {
        conditions.push(eq(jobs.status, 'DRAFT'));
      } else if (normalized === 'CLOSED' || normalized === 'INACTIVE') {
        conditions.push(eq(jobs.status, 'INACTIVE'));
      }
    }
    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(jobs.title, s),
          ilike(jobs.role, s),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [[{ total }], jobRows] = await Promise.all([
      this.db.select({ total: count() }).from(jobs).where(whereClause),
      this.db.query.jobs.findMany({
        where: whereClause,
        with: {
          employer: {
            with: {
              user: true,
            },
          },
          submissions: true,
          simulation: true,
        },
        orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
        limit,
        offset,
      }),
    ]);

    const totalCount = Number(total) || 0;
    const totalPages = Math.ceil(totalCount / limit);

    const items = jobRows.map((job) => {
      const scored = job.submissions?.filter((s) => s.status === 'SCORED') || [];
      const avgScore =
        scored.length > 0
          ? Math.round(
              scored.reduce((acc, s) => acc + (Number(s.overallScore) || 0), 0) /
                scored.length,
            )
          : null;
      const flaggedCount =
        job.submissions?.filter((s) => s.isAntiCheatFlagged).length || 0;

      return {
        id: job.id,
        title: job.title || 'Untitled Role',
        company: job.employer?.companyName || 'Unknown Company',
        employerEmail: job.employer?.user?.email,
        isEmployerVerified: job.employer?.user?.isEmailVerified ?? false,
        status: (job.status === 'ACTIVE'
          ? 'live'
          : job.status === 'DRAFT'
            ? 'draft'
            : 'closed') as 'live' | 'draft' | 'closed',
        rawStatus: job.status,
        applicantCount: job.submissions?.length || 0,
        scoredApplicantCount: scored.length,
        averageScore: avgScore,
        flaggedCount,
        createdAt: job.createdAt,
        isSimulationReady: !!job.simulation,
        simulationTaskCount: job.simulation?.tasks?.length || 0,
        role: job.role,
        skillLevel: job.skillLevel,
        skillCategory: job.skillCategory,
        location: job.location,
        isRemoteFriendly: job.isRemoteFriendly,
        employmentType: job.employmentType,
        salaryRange: job.salaryRange,
        requiredSkills: job.requiredSkills || [],
        applicationDeadline: job.applicationDeadline,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getJobDetail(jobId: string) {
    const job = await this.db.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
      with: {
        employer: {
          with: {
            user: true,
          },
        },
        simulation: true,
        submissions: {
          with: {
            candidate: {
              with: {
                user: true,
              },
            },
          },
          orderBy: (submissions, { desc }) => [desc(submissions.createdAt)],
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job post not found');
    }

    const scoredSubmissions = job.submissions.filter(
      (s) => s.status === 'SCORED' && s.overallScore !== null,
    );
    const avgScore =
      scoredSubmissions.length > 0
        ? Math.round(
            scoredSubmissions.reduce(
              (acc, s) => acc + (Number(s.overallScore) || 0),
              0,
            ) / scoredSubmissions.length,
          )
        : null;

    return {
      id: job.id,
      title: job.title || 'Untitled Role',
      description: job.description,
      requiredSkills: job.requiredSkills || [],
      role: job.role,
      skillLevel: job.skillLevel,
      skillCategory: job.skillCategory,
      companyDescription: job.companyDescription,
      isRemoteFriendly: job.isRemoteFriendly,
      location: job.location,
      employmentType: job.employmentType,
      salaryRange: job.salaryRange,
      applicationDeadline: job.applicationDeadline,
      businessProblem: job.businessProblem,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      employer: {
        id: job.employer?.id,
        companyName: job.employer?.companyName || 'Unknown Company',
        fullName: job.employer?.fullName,
        email: job.employer?.user?.email,
        isVerified: job.employer?.user?.isEmailVerified ?? false,
        phoneNumber: job.employer?.phoneNumber,
      },
      simulation: job.simulation
        ? {
            id: job.simulation.id,
            timeLimitMinutes: job.simulation.timeLimitMinutes,
            taskCount: job.simulation.tasks?.length || 0,
            tasks: job.simulation.tasks,
          }
        : null,
      stats: {
        totalApplicants: job.submissions.length,
        scoredApplicants: scoredSubmissions.length,
        averageScore: avgScore,
        flaggedApplicants: job.submissions.filter((s) => s.isAntiCheatFlagged).length,
      },
      submissions: job.submissions.map((sub) => ({
        id: sub.id,
        candidateId: sub.candidate?.userId || sub.candidate?.id || null,
        candidateName:
          sub.candidate?.fullName ||
          sub.guestInfo?.fullName ||
          sub.candidate?.user?.email?.split('@')[0] ||
          'Anonymous Candidate',
        candidateEmail:
          sub.candidate?.user?.email ||
          sub.guestInfo?.email ||
          'No email recorded',
        overallScore: sub.overallScore ? Number(sub.overallScore) : null,
        status: sub.status,
        isAntiCheatFlagged: sub.isAntiCheatFlagged,
        antiCheatFlags: sub.antiCheatFlags || [],
        timeTakenSeconds: sub.timeTakenSeconds,
        categoryScores: sub.categoryScores,
        taskScores: sub.taskScores,
        completedAt: sub.completedAt,
        createdAt: sub.createdAt,
      })),
    };
  }

  async updateJobStatus(jobId: string, status: (typeof jobs.status.enumValues)[number]) {
    const [updated] = await this.db
      .update(jobs)
      .set({ status, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();
    if (!updated) {
      throw new NotFoundException('Job post not found');
    }
    return updated;
  }

  async setUserActiveStatus(
    userId: string,
    isActive: boolean,
    currentAdminId?: string,
    suspensionReason?: string,
  ) {
    if (currentAdminId && userId === currentAdminId && !isActive) {
      throw new BadRequestException('You cannot disable your own admin account');
    }

    const targetUser = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const isSuperAdmin =
      targetUser.email === process.env.ADMIN_EMAIL ||
      targetUser.email === 'enweremproper@gmail.com';

    if (isSuperAdmin && !isActive) {
      throw new BadRequestException('The Super Admin account cannot be disabled.');
    }

    const [user] = await this.db
      .update(users)
      .set({
        isActive,
        suspensionReason: isActive ? null : (suspensionReason || 'Account suspended by administrator.'),
        suspendedAt: isActive ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
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

  async listGenerationReviewItems(
    query: ListGenerationReviewsQueryDto = {},
  ): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (query.status) {
      conditions.push(
        eq(generationReviewItems.status, query.status as GenerationReviewStatus),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [[{ total }], items] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(generationReviewItems)
        .where(whereClause),
      this.db.query.generationReviewItems.findMany({
        where: whereClause,
        with: { job: true },
        orderBy: (items, { desc }) => [desc(items.createdAt)],
        limit,
        offset,
      }),
    ]);

    const totalCount = Number(total) || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
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

  async getCandidateDetail(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('Candidate not found');
    }

    const profile = await this.db.query.jobSeekerProfiles.findFirst({
      where: eq(jobSeekerProfiles.userId, user.id),
      with: {
        submissions: {
          with: {
            job: {
              with: {
                employer: true,
              },
            },
            simulation: true,
          },
          orderBy: (submissions, { desc }) => [desc(submissions.createdAt)],
        },
      },
    });

    const submissionsList = profile?.submissions || [];
    const scoredSubmissions = submissionsList.filter(
      (s) => s.status === 'SCORED' && s.overallScore !== null,
    );
    const avgScore =
      scoredSubmissions.length > 0
        ? Math.round(
            scoredSubmissions.reduce(
              (acc, s) => acc + (Number(s.overallScore) || 0),
              0,
            ) / scoredSubmissions.length,
          )
        : null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      suspensionReason: user.suspensionReason,
      suspendedAt: user.suspendedAt,
      createdAt: user.createdAt,
      name: profile?.fullName || user.email.split('@')[0],
      status: (user.isActive ? 'active' : 'suspended') as 'active' | 'suspended',
      profile: {
        id: profile?.id,
        fullName: profile?.fullName || user.email.split('@')[0],
        phoneNumber: profile?.phoneNumber || null,
        capabilityScores: profile?.capabilityScores || null,
      },
      stats: {
        totalApplications: submissionsList.length,
        completedSubmissions: scoredSubmissions.length,
        averageScore: avgScore,
        antiCheatFlaggedCount: submissionsList.filter((s) => s.isAntiCheatFlagged).length,
      },
      submissions: submissionsList.map((sub) => ({
        id: sub.id,
        jobId: sub.jobId,
        jobTitle: sub.job?.title || 'Untitled Role',
        companyName: sub.job?.employer?.companyName || 'Unknown Company',
        simulationTitle: sub.job?.title ? `${sub.job.title} Simulation` : 'Job Simulation',
        status: sub.status,
        overallScore: sub.overallScore ? Number(sub.overallScore) : null,
        categoryScores: sub.categoryScores,
        taskScores: sub.taskScores,
        timeTakenSeconds: sub.timeTakenSeconds,
        isAntiCheatFlagged: sub.isAntiCheatFlagged,
        antiCheatFlags: sub.antiCheatFlags,
        startedAt: sub.startedAt,
        completedAt: sub.completedAt,
        createdAt: sub.createdAt,
      })),
    };
  }
}
