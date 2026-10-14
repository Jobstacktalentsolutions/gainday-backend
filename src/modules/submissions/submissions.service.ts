import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and, inArray, isNotNull, ne, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  submissions,
  CandidateAnswer,
  AntiCheatEvent,
  SubmissionStatus,
} from '../../db/schema';
import { GradingService } from '../grading/grading.service';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import { resolveCandidateContact } from './candidate-contact';

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
];

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly gradingService: GradingService,
    private readonly creditLedger: CreditLedgerService,
  ) {}

  async createSubmission(
    jobId: string,
    simulationId: string,
    candidateId: string,
  ) {
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
   * Employer-facing list for a job. Candidates stay anonymous (no identity fields at all) until
   * `employerId` has unlocked them � see toEmployerView.
   */
  async findByJobForEmployer(jobId: string, employerId: string) {
    const rows = await this.db.query.submissions.findMany({
      where: and(
        eq(submissions.jobId, jobId),
        ne(submissions.status, 'WITHDRAWN'),
      ),
      with: { candidate: { with: { user: true } } },
    });
    const unlockedIds = await this.creditLedger.findUnlockedSubmissionIds(
      employerId,
      rows.map((row) => row.id),
    );
    return rows.map((row) => this.toEmployerView(row, unlockedIds.has(row.id)));
  }

  async findByIdForEmployer(id: string, employerId: string) {
    const row = await this.db.query.submissions.findFirst({
      where: and(eq(submissions.id, id), ne(submissions.status, 'WITHDRAWN')),
      with: {
        job: true,
        simulation: true,
        candidate: { with: { user: true } },
      },
    });
    if (!row) {
      return null;
    }
    const unlockedIds = await this.creditLedger.findUnlockedSubmissionIds(
      employerId,
      [id],
    );
    return this.toEmployerView(row, unlockedIds.has(id));
  }

  // Strips the candidate's identity (profile and guest details) and only hands back contact
  // details for unlocked submissions, so the pay-to-unlock rule is enforced here on the server
  // rather than by what the frontend chooses to render.
  private toEmployerView<
    T extends Parameters<typeof resolveCandidateContact>[0],
  >(row: T, isUnlocked: boolean) {
    const { candidate, guestInfo, ...rest } = row;
    return {
      ...rest,
      isUnlocked,
      contact: isUnlocked
        ? resolveCandidateContact({ candidate, guestInfo })
        : null,
    };
  }

  async findById(id: string) {
    const submission = await this.db.query.submissions.findFirst({
      where: eq(submissions.id, id),
      with: { job: true, simulation: true, candidate: true },
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

  /** Every job the candidate has an application for, withdrawn ones included, so the job board
   *  keeps showing them as applied. */
  async findAppliedJobIds(candidateId: string): Promise<string[]> {
    const rows = await this.db
      .select({ jobId: submissions.jobId })
      .from(submissions)
      .where(eq(submissions.candidateId, candidateId));
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
}
