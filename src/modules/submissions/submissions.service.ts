import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, inArray, isNotNull, ne, desc, asc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  submissions,
  CandidateAnswer,
  AntiCheatEvent,
  SubmissionStatus,
  UserRole,
  jobs,
  jobExtractions,
  jobSeekerProfiles,
  JobSeekerProfile,
} from '../../db/schema';
import { GradingService } from '../grading/grading.service';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import { CandidateNotificationsService } from '../notifications/candidate-notifications.service';
import { RoleRegistry } from '../generation/roles/role-registry';
import { sanitizeTaskForCandidate } from '../simulations/candidate-task.util';
import { resolveCandidateContact } from './candidate-contact';
import {
  buildEmployerTaskResults,
  buildTaskResults,
  capabilityDomainSql,
  capabilityPoints,
  deriveIntegrityStatus,
  runningAverage,
  summarizeIntegrityEvents,
  toCategoryScores,
  toDisplayId,
} from './employer-submission.view';

// A heartbeat older than this by the time the candidate submits means the client went quiet
// (tab closed, machine slept, network down, or deliberately stopped pinging) for longer than a
// couple of missed beats — auto-flagged alongside whatever the client itself reported. Frontend
// pings every 20s (useConnectionMonitor's PING_INTERVAL_MS) — this must stay well above that so
// a single dropped ping doesn't false-positive.
const HEARTBEAT_STALE_THRESHOLD_MS = 90_000;

// Defense in depth against a misbehaving/malicious client sending an unbounded events array —
// the frontend already caps its own in-memory log at 500 (useSimulationIntegrityStore.ts), this
// just makes sure the backend never trusts that cap was actually applied client-side.
const MAX_ANTI_CHEAT_EVENTS = 1000;

// Statuses a candidate can still withdraw from. Once the employer has decided (SELECTED /
// NOT_SELECTED), the candidate was disqualified, or they already withdrew, it's final.
const WITHDRAWABLE_STATUSES: SubmissionStatus[] = [
  'PENDING',
  'GRADING',
  'GRADED',
  'GRADING_FAILED',
];

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly gradingService: GradingService,
    private readonly creditLedger: CreditLedgerService,
    private readonly roleRegistry: RoleRegistry,
    private readonly candidateNotifications: CandidateNotificationsService,
  ) {}

  async createSubmission(
    jobId: string,
    simulationId: string,
    candidateId: string,
  ) {
    const [candidate] = await this.db
      .select({ isProfileComplete: jobSeekerProfiles.isProfileComplete })
      .from(jobSeekerProfiles)
      .where(eq(jobSeekerProfiles.id, candidateId));
    if (!candidate?.isProfileComplete) {
      throw new ForbiddenException(
        'Complete your profile before applying for a job',
      );
    }

    const [job] = await this.db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, jobId));
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.status !== 'ACTIVE') {
      throw new ConflictException(
        'This job is no longer accepting applications',
      );
    }

    // Withdrawing is permanent, and that includes re-applying to the same job.
    const [withdrawn] = await this.db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.jobId, jobId),
          eq(submissions.candidateId, candidateId),
          eq(submissions.status, 'WITHDRAWN'),
        ),
      )
      .limit(1);
    if (withdrawn) {
      throw new ConflictException(
        'You withdrew your application for this job and cannot apply again',
      );
    }

    const now = new Date();
    const [submission] = await this.db
      .insert(submissions)
      .values({
        jobId,
        simulationId,
        candidateId,
        status: 'PENDING',
        startedAt: now,
        // Seeded to the start time rather than left null, so there's no artificial "stale
        // heartbeat" gap before the client's first ping ever lands (see
        // HEARTBEAT_STALE_THRESHOLD_MS).
        lastHeartbeatAt: now,
        answers: [],
      })
      .returning();
    return submission;
  }

  /**
   * POST /submissions/:id/heartbeat — an authenticated liveness ping from the candidate's
   * client during an active run. Ownership is enforced by the controller (candidateId must
   * match the caller's own profile) before this is called.
   */
  async recordHeartbeat(submissionId: string) {
    const [updated] = await this.db
      .update(submissions)
      .set({ lastHeartbeatAt: new Date() })
      .where(eq(submissions.id, submissionId))
      .returning();
    if (!updated) {
      throw new Error('Submission not found');
    }
    return { status: updated.status, serverTime: new Date().toISOString() };
  }

  async submitAnswers(
    submissionId: string,
    answers: CandidateAnswer[],
    clientAntiCheatEvents: AntiCheatEvent[] = [],
  ) {
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

    // Server-observed signal, not just what the client chose to report — a client that
    // suppresses its own tab-visibility/window-blur listeners (e.g. via devtools) can't
    // suppress this, since it's derived from when heartbeats actually stopped arriving, not
    // from anything the client asserts about itself.
    const heartbeatAgeMs = submission.lastHeartbeatAt
      ? completedAt.getTime() - submission.lastHeartbeatAt.getTime()
      : null;
    const events = clientAntiCheatEvents.slice(0, MAX_ANTI_CHEAT_EVENTS);
    if (
      heartbeatAgeMs !== null &&
      heartbeatAgeMs > HEARTBEAT_STALE_THRESHOLD_MS
    ) {
      events.push({
        type: 'server-stale-heartbeat',
        taskId: null,
        occurredAt: completedAt.toISOString(),
        durationMs: heartbeatAgeMs,
      });
    }

    const [updated] = await this.db
      .update(submissions)
      .set({
        answers,
        completedAt,
        timeTakenSeconds,
        antiCheatFlags: events,
        isAntiCheatFlagged: events.length > 0,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId))
      .returning();

    // Async, off the request path — grading (and, if this is the first submission to reach a
    // given task, anchor generation for it) happens in the background. See GradingService.
    await this.gradingService.queueGrading(submissionId);

    return updated;
  }

  /**
   * Employer-facing list for a job: submitted applications only (a run that was started but
   * never submitted isn't one, and withdrawn ones are hidden from employers). Candidates stay
   * anonymous — no name, no contact — until `employerId` has unlocked them.
   */
  async findByJobForEmployer(jobId: string, employerId: string) {
    const rows = await this.db.query.submissions.findMany({
      where: and(
        eq(submissions.jobId, jobId),
        ne(submissions.status, 'WITHDRAWN'),
        isNotNull(submissions.completedAt),
      ),
      with: { candidate: { with: { user: true } } },
    });
    const [unlockedIds, capabilityHistories] = await Promise.all([
      this.creditLedger.findUnlockedSubmissionIds(
        employerId,
        rows.map((row) => row.id),
      ),
      this.findCapabilityHistories(jobId, rows),
    ]);
    return rows.map((row) =>
      this.toEmployerListItem(
        row,
        unlockedIds.has(row.id),
        capabilityHistories.get(row.id) ?? [],
      ),
    );
  }

  async findByIdForEmployer(id: string, employerId: string) {
    const row = await this.db.query.submissions.findFirst({
      where: and(
        eq(submissions.id, id),
        ne(submissions.status, 'WITHDRAWN'),
        isNotNull(submissions.completedAt),
      ),
      with: {
        simulation: true,
        candidate: { with: { user: true } },
      },
    });
    if (!row) {
      return null;
    }
    const [unlockedIds, capabilityHistories] = await Promise.all([
      this.creditLedger.findUnlockedSubmissionIds(employerId, [id]),
      this.findCapabilityHistories(row.jobId, [row]),
    ]);
    const isUnlocked = unlockedIds.has(id);
    return {
      ...this.toEmployerListItem(
        row,
        isUnlocked,
        capabilityHistories.get(id) ?? [],
      ),
      jobId: row.jobId,
      // Stripped of answer keys the same way the candidate's own copy is; the review page only
      // needs the interface and structured component to show the answer read-only.
      tasks: buildEmployerTaskResults(
        row.simulation.tasks.map((task) =>
          sanitizeTaskForCandidate(task, this.roleRegistry),
        ),
        row.answers,
        row.taskScores,
        row.candidate ? row.candidate.pronouns : null,
      ),
      integrityEvents: summarizeIntegrityEvents(row.antiCheatFlags),
      // Only ever populated once unlocked, so the pay-to-unlock rule is enforced here on the
      // server rather than by what the frontend chooses to render.
      contact: isUnlocked ? this.toEmployerContact(row) : null,
    };
  }

  async updateSelectionStatus(
    id: string,
    employerId: string,
    selected: boolean,
    userRole?: string,
  ) {
    const row = await this.db.query.submissions.findFirst({
      where: eq(submissions.id, id),
      with: {
        job: { with: { employer: true } },
        candidate: { with: { user: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Submission not found');
    }
    if (userRole !== UserRole.ADMIN && row.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You may only update submissions for your own jobs',
      );
    }
    if (selected && userRole !== UserRole.ADMIN) {
      const unlockedIds = await this.creditLedger.findUnlockedSubmissionIds(
        employerId,
        [id],
      );
      if (!unlockedIds.has(id)) {
        throw new ForbiddenException(
          'You must unlock this candidate before selecting them',
        );
      }
    }
    const newStatus: SubmissionStatus = selected ? 'SELECTED' : 'GRADED';
    const [updated] = await this.db
      .update(submissions)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, id))
      .returning();

    // Only the transition notifies, so re-selecting an already selected candidate stays quiet.
    const contact = resolveCandidateContact(row);
    if (selected && row.status !== 'SELECTED' && row.candidateId && contact) {
      await this.candidateNotifications.notifySelected({
        candidateId: row.candidateId,
        candidateEmail: contact.email,
        candidateName: contact.fullName,
        submissionId: row.id,
        jobId: row.jobId,
        jobTitle: row.job.title ?? 'this role',
        companyName: row.job.employer.companyName,
      });
    }

    return {
      id: updated.id,
      status: updated.status,
      isSelected: updated.status === 'SELECTED',
    };
  }

  private toEmployerContact(
    row: Parameters<typeof resolveCandidateContact>[0],
  ) {
    const contact = resolveCandidateContact(row);
    return contact
      ? { email: contact.email, phone: contact.phoneNumber }
      : null;
  }

  // Gender and pronouns are shown to employers even while the candidate is locked; the brief
  // stays behind the unlock with the rest of the identifying details. Null once the
  // candidate's account has been deleted.
  private toEmployerCandidateProfile(
    candidate: Pick<JobSeekerProfile, 'gender' | 'pronouns' | 'brief'> | null,
    isUnlocked: boolean,
  ) {
    if (!candidate) {
      return null;
    }
    return {
      gender: candidate.gender,
      pronouns: candidate.pronouns,
      brief: isUnlocked ? candidate.brief : null,
    };
  }

  private toEmployerListItem(
    row: typeof submissions.$inferSelect &
      Parameters<typeof resolveCandidateContact>[0] & {
        candidate: Pick<
          JobSeekerProfile,
          'gender' | 'pronouns' | 'brief'
        > | null;
      },
    isUnlocked: boolean,
    capabilityHistory: number[],
  ) {
    return {
      id: row.id,
      displayId: toDisplayId(row.id),
      status: row.status,
      isSelected: row.status === 'SELECTED',
      // Null while locked.
      candidateName: isUnlocked
        ? (resolveCandidateContact(row)?.fullName ?? null)
        : null,
      candidateProfile: this.toEmployerCandidateProfile(
        row.candidate,
        isUnlocked,
      ),
      isUnlocked,
      // completedAt is non-null for every row the employer queries return.
      submittedAt: row.completedAt!.toISOString(),
      timeTakenSeconds: row.timeTakenSeconds,
      // Null until graded.
      overallScore: row.overallScore,
      categoryScores: row.categoryScores
        ? toCategoryScores(row.categoryScores)
        : null,
      capabilityScore: capabilityHistory.at(-1) ?? null,
      capabilityHistory,
      integrityStatus: deriveIntegrityStatus(row.status, row.antiCheatFlags),
      integrityIssueCount: (row.antiCheatFlags ?? []).length,
    };
  }

  /**
   * Per submission, the candidate's capability score after each of their applications in this
   * job's domain up to and including that one (oldest first; the last entry is the current
   * score). Ungraded ones, and ones whose candidate account was deleted, have no history.
   */
  private async findCapabilityHistories(
    jobId: string,
    rows: { id: string; candidateId: string | null }[],
  ): Promise<Map<string, number[]>> {
    const candidateIds = [
      ...new Set(rows.flatMap((row) => row.candidateId ?? [])),
    ];
    if (candidateIds.length === 0) {
      return new Map();
    }

    // Same domain lookup the grading pipeline uses (GradingService.gradeSubmission).
    const domainOf = capabilityDomainSql();
    const [{ domain }] = await this.db
      .select({ domain: domainOf })
      .from(jobs)
      .leftJoin(jobExtractions, eq(jobExtractions.jobId, jobs.id))
      .where(eq(jobs.id, jobId));

    const graded = await this.db
      .select({
        id: submissions.id,
        candidateId: submissions.candidateId,
        categoryScores: submissions.categoryScores,
      })
      .from(submissions)
      .innerJoin(jobs, eq(jobs.id, submissions.jobId))
      .leftJoin(jobExtractions, eq(jobExtractions.jobId, jobs.id))
      .where(
        and(
          inArray(submissions.candidateId, candidateIds),
          isNotNull(submissions.categoryScores),
          isNotNull(submissions.completedAt),
          ne(submissions.status, 'DISQUALIFIED'),
          sql`${domainOf} = ${domain}`,
        ),
      )
      .orderBy(asc(submissions.completedAt));

    const histories = new Map<string, number[]>();
    const gradedByCandidate = new Map<string | null, typeof graded>();
    for (const row of graded) {
      const candidateRows = gradedByCandidate.get(row.candidateId) ?? [];
      candidateRows.push(row);
      gradedByCandidate.set(row.candidateId, candidateRows);
    }
    for (const candidateRows of gradedByCandidate.values()) {
      const running = runningAverage(
        candidateRows.map((row) => capabilityPoints(row.categoryScores!)),
      );
      candidateRows.forEach((row, index) => {
        histories.set(row.id, running.slice(0, index + 1));
      });
    }
    return histories;
  }

  async findById(id: string) {
    const submission = await this.db.query.submissions.findFirst({
      where: eq(submissions.id, id),
      with: {
        job: {
          with: { employer: true },
        },
        simulation: true,
        candidate: {
          with: { user: true },
        },
      },
    });
    return submission ?? null;
  }

  /** Submissions with their job and the identity needed to contact the candidate. */
  async findManyWithContactByIds(ids: string[]) {
    return this.db.query.submissions.findMany({
      where: inArray(submissions.id, ids),
      with: { job: true, candidate: { with: { user: true } } },
    });
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

  /** Every job the candidate has submitted an application for, withdrawn ones included, so the
   *  job board keeps showing them as applied. A run that was started but never submitted isn't
   *  an application (see findApplicationsForCandidate), so it doesn't count. */
  async findAppliedJobIds(candidateId: string): Promise<string[]> {
    const rows = await this.db
      .select({ jobId: submissions.jobId })
      .from(submissions)
      .where(
        and(
          eq(submissions.candidateId, candidateId),
          isNotNull(submissions.completedAt),
        ),
      );
    return [...new Set(rows.map((row) => row.jobId))];
  }

  /** The candidate's submitted applications, newest first. A run that was started but never
   *  submitted has no `completedAt` and is not an application yet, so it's left out. */
  async findApplicationsForCandidate(candidateId: string) {
    const rows = await this.db.query.submissions.findMany({
      where: and(
        eq(submissions.candidateId, candidateId),
        isNotNull(submissions.completedAt),
      ),
      with: { job: { with: { employer: true } } },
      orderBy: desc(submissions.completedAt),
    });
    return rows.map((row) => this.toCandidateApplication(row));
  }

  async findApplicationForCandidate(id: string, candidateId: string) {
    const row = await this.db.query.submissions.findFirst({
      where: and(
        eq(submissions.id, id),
        eq(submissions.candidateId, candidateId),
        isNotNull(submissions.completedAt),
      ),
      with: { job: { with: { employer: true } } },
    });
    if (!row) {
      return null;
    }
    const { job } = row;
    return {
      ...this.toCandidateApplication(row),
      job: {
        description: job.description,
        location: job.location,
        employmentType: job.employmentType,
        isRemoteFriendly: job.isRemoteFriendly,
        skillLevel: job.skillLevel,
        requiredSkills: job.requiredSkills,
        salaryRange: job.salaryRange,
        applicationDeadline: job.applicationDeadline?.toISOString() ?? null,
      },
    };
  }

  /** Permanent. The status guard is in the WHERE so a concurrent employer decision or grading
   *  result can't be overwritten between the read and the write. */
  async withdraw(submissionId: string) {
    const [updated] = await this.db
      .update(submissions)
      .set({ status: 'WITHDRAWN', updatedAt: new Date() })
      .where(
        and(
          eq(submissions.id, submissionId),
          inArray(submissions.status, WITHDRAWABLE_STATUSES),
        ),
      )
      .returning();
    if (!updated) {
      throw new ConflictException(
        'This application can no longer be withdrawn',
      );
    }
    return updated;
  }

  private toCandidateApplication(
    row: typeof submissions.$inferSelect & {
      job: {
        id: string;
        title: string | null;
        employer: { companyName: string | null };
      };
    },
  ) {
    const isFinal: SubmissionStatus[] = [
      'WITHDRAWN',
      'SELECTED',
      'NOT_SELECTED',
      'DISQUALIFIED',
    ];
    return {
      id: row.id,
      jobId: row.job.id,
      jobTitle: row.job.title,
      companyName: row.job.employer.companyName,
      status: row.status,
      // completedAt is non-null for every row these queries return.
      submittedAt: row.completedAt!.toISOString(),
      // The last write to the row once it has reached a final status; null while it is still
      // being graded or awaiting a decision.
      decidedAt: isFinal.includes(row.status)
        ? row.updatedAt.toISOString()
        : null,
      rating: row.overallScore,
    };
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

  /**
   * The candidate-facing result for a graded submission. Ownership is checked by the controller.
   * Everything here comes from the stored grading result — nothing is filled in when it is
   * missing; a submission that hasn't finished grading has no result to show yet.
   */
  async getCandidateResult(submissionId: string) {
    const submission = await this.db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: { job: { with: { employer: true } }, simulation: true },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const { overallScore, categoryScores, taskScores, completedAt } =
      submission;
    if (
      overallScore === null ||
      categoryScores === null ||
      taskScores === null ||
      completedAt === null
    ) {
      throw new ConflictException(
        'Results are not available until grading is complete',
      );
    }

    const capabilityHistories = await this.findCapabilityHistories(
      submission.jobId,
      [submission],
    );
    const capabilityHistory = capabilityHistories.get(submission.id) ?? [];

    const { problemSolving, judgmentExecution, writtenCommunication } =
      toCategoryScores(categoryScores);

    return {
      id: submission.id,
      status: submission.status,
      overallScore,
      completedDate: completedAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      job: {
        id: submission.job.id,
        title: submission.job.title,
        companyName: submission.job.employer.companyName,
        location: submission.job.location,
        employmentType: submission.job.employmentType,
      },
      metrics: [
        {
          label: 'PROBLEM SOLVING & JUDGEMENT',
          score: Math.round((problemSolving + judgmentExecution) / 2),
        },
        { label: 'EXECUTION', score: judgmentExecution },
        { label: 'WRITTEN COMMUNICATION', score: writtenCommunication },
      ],
      // Null when there is no history, e.g. a disqualified submission.
      cumulativeCapabilityScore: capabilityHistory.at(-1) ?? null,
      capabilityHistory,
      taskEvidence: buildTaskResults(
        submission.simulation.tasks,
        taskScores,
      ).map(({ taskId, taskNumber, title, score, evidence }) => ({
        taskId,
        taskNumber,
        title,
        score,
        summary: evidence,
      })),
    };
  }
}
