import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { submissions, CandidateAnswer, AntiCheatEvent } from '../../db/schema';
import { GradingService } from '../grading/grading.service';

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

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly gradingService: GradingService,
  ) {}

  async findAppliedJobIds(candidateId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ jobId: submissions.jobId })
      .from(submissions)
      .where(eq(submissions.candidateId, candidateId));
    return rows.map((r) => r.jobId);
  }

  async createSubmission(
    jobId: string,
    simulationId: string,
    candidateId: string,
  ) {
    const existing = await this.db.query.submissions.findFirst({
      where: and(
        eq(submissions.jobId, jobId),
        eq(submissions.candidateId, candidateId),
      ),
    });
    if (existing) {
      throw new BadRequestException('You have already applied for this job.');
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

  async findByJob(jobId: string) {
    return this.db.query.submissions.findMany({
      where: eq(submissions.jobId, jobId),
      with: { candidate: true },
    });
  }

  async findById(id: string) {
    const submission = await this.db.query.submissions.findFirst({
      where: eq(submissions.id, id),
      with: {
        job: {
          with: { employer: true },
        },
        simulation: true,
        candidate: true,
      },
    });
    return submission ?? null;
  }

  async getCandidateResult(submission: any) {
    const job = submission.job;
    const simulation = submission.simulation;
    const tasks = simulation?.tasks ?? [];

    // Query real scored submissions for this job to compute real percentile on-demand
    let percentileText = 'Overall score out of 100';
    if (submission.jobId) {
      const allScored = await this.db
        .select({ overallScore: submissions.overallScore })
        .from(submissions)
        .where(
          and(
            eq(submissions.jobId, submission.jobId),
            eq(submissions.status, 'SCORED'),
          ),
        );

      const candidateScore = Number(submission.overallScore ?? 0);
      const totalApplicants = allScored.length;

      if (totalApplicants > 1) {
        const lowerCount = allScored.filter(
          (s) => Number(s.overallScore ?? 0) < candidateScore,
        ).length;
        const topPercentile = Math.max(
          1,
          Math.round(100 - (lowerCount / totalApplicants) * 100),
        );
        percentileText = `Overall score · top ${topPercentile}% of ${totalApplicants} applicants for this role`;
      } else if (totalApplicants === 1) {
        percentileText = `Overall score · 1st applicant for this role`;
      }
    }

    const taskEvidence = (submission.taskScores ?? []).map((tScore: any, idx: number) => {
      const matchingTask = tasks.find(
        (t: any) =>
          t.id === tScore.taskId ||
          (tScore.questionBankId && t.questionBankId === tScore.questionBankId),
      );
      return {
        taskId: tScore.taskId,
        taskNumber: idx + 1,
        title: matchingTask?.title ?? `Task ${idx + 1}`,
        summary: tScore.summary ?? 'Evaluation in progress.',
      };
    });

    const catScores = submission.categoryScores ?? {};
    const getPct = (val: any, fallback = 75) => {
      if (val === undefined || val === null) return fallback;
      const num = typeof val === 'number' ? val : (val.score ?? fallback);
      return num <= 10 ? Math.round(num * 10) : Math.round(num);
    };

    const metrics = [
      { label: 'PROBLEM SOLVED', score: getPct(catScores.problemSolving, 82) },
      { label: 'EXECUTION', score: getPct(catScores.judgmentExecution, 76) },
      { label: 'COMMUNICATION', score: getPct(catScores.writtenCommunication, 88) },
      { label: 'JUDGEMENT', score: getPct(catScores.judgmentExecution, 74) },
      { label: 'ATTENTION TO DETAIL', score: getPct(catScores.commercialDomainAwareness, 91) },
    ];

    const overallScore = submission.overallScore
      ? Math.round(Number(submission.overallScore))
      : 82;

    const completedDate = submission.completedAt
      ? new Date(submission.completedAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

    return {
      id: submission.id,
      status: submission.status,
      overallScore,
      percentileText,
      completedDate,
      job: {
        id: job?.id ?? '',
        title: job?.title ?? 'Custody Operations Analyst',
        companyName: job?.employer?.companyName ?? 'Stanbic IBTC Custody',
        location: job?.location ?? 'Remote',
        employmentType: job?.employmentType ?? 'Full-time',
      },
      metrics,
      cumulativeCapabilityScore: 721,
      cumulativeDelta: '+18 from last result',
      taskEvidence,
    };
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
}
