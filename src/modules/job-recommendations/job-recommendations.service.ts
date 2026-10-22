import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  candidateMatchEmbeddings,
  JobRecommendationRunStatus,
  JobStatus,
  jobMatchEmbeddings,
  jobRecommendationRuns,
  jobRecommendations,
  jobs,
  jobSeekerProfiles,
  submissions,
  users,
} from '../../db/schema';
import { chunk } from '../../common/chunk.util';
import { CandidateNotificationsService } from '../notifications/candidate-notifications.service';
import {
  NotificationCategory,
  NotificationPreferencesService,
} from '../notifications/notification-preferences.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JobMatchEmbeddingService } from './job-match-embedding.service';
import { jobRecommendationConfig } from './job-recommendations.constants';
import {
  CandidateMatch,
  groupMatchesByCandidate,
} from './job-recommendation.util';

const WRITE_BATCH_SIZE = 500;

interface ActivatedJob {
  id: string;
  title: string;
}

interface SavedRecommendation {
  candidateId: string;
  jobId: string;
}

interface Recipient {
  candidateId: string;
  userId: string;
  email: string;
  fullName: string;
}

interface Delivery extends SavedRecommendation {
  recipient: Recipient;
  jobTitle: string;
}

/**
 * Recommends newly live jobs to candidates whose title is close to the job. Each pass covers the
 * jobs activated since the last successful pass, so a pass that fails is covered by the next one.
 */
@Injectable()
export class JobRecommendationsService {
  private readonly logger = new Logger(JobRecommendationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly embeddings: JobMatchEmbeddingService,
    private readonly candidateNotifications: CandidateNotificationsService,
    private readonly preferences: NotificationPreferencesService,
    private readonly notifications: NotificationsService,
  ) {}

  async runPass(): Promise<void> {
    const startedAt = new Date();
    const [run] = await this.db
      .insert(jobRecommendationRuns)
      .values({ startedAt, status: JobRecommendationRunStatus.RUNNING })
      .returning({ id: jobRecommendationRuns.id });

    try {
      const previousStart = await this.lastSucceededStart();
      // The first pass only sets the starting point, so jobs that were already live are not
      // announced to every candidate at once.
      const windowStart = previousStart === null ? startedAt : previousStart;
      const activatedJobs = await this.findJobsActivatedBetween(
        windowStart,
        startedAt,
      );

      let recommendationsCreated = 0;
      if (activatedJobs.length > 0) {
        await this.embeddings.syncCandidates();
        await this.embeddings.syncJobs(activatedJobs.map((job) => job.id));
        const matches = await this.findMatches(
          activatedJobs.map((job) => job.id),
        );
        recommendationsCreated = await this.saveAndNotify(
          run.id,
          matches,
          activatedJobs,
        );
      }

      await this.db
        .update(jobRecommendationRuns)
        .set({
          status: JobRecommendationRunStatus.SUCCEEDED,
          completedAt: new Date(),
          jobsConsidered: activatedJobs.length,
          recommendationsCreated,
        })
        .where(eq(jobRecommendationRuns.id, run.id));

      this.logger.log(
        `Job recommendations pass ${run.id}: ${activatedJobs.length} job(s) considered, ${recommendationsCreated} recommendation(s) created`,
      );
    } catch (err) {
      await this.db
        .update(jobRecommendationRuns)
        .set({
          status: JobRecommendationRunStatus.FAILED,
          completedAt: new Date(),
          error: err instanceof Error ? err.message : String(err),
        })
        .where(eq(jobRecommendationRuns.id, run.id));
      throw err;
    }
  }

  /** Start time of the most recent successful pass, or null if none has succeeded yet. */
  private async lastSucceededStart(): Promise<Date | null> {
    const [previous] = await this.db
      .select({ startedAt: jobRecommendationRuns.startedAt })
      .from(jobRecommendationRuns)
      .where(
        eq(jobRecommendationRuns.status, JobRecommendationRunStatus.SUCCEEDED),
      )
      .orderBy(desc(jobRecommendationRuns.startedAt))
      .limit(1);
    return previous ? previous.startedAt : null;
  }

  private async findJobsActivatedBetween(
    from: Date,
    to: Date,
  ): Promise<ActivatedJob[]> {
    const rows = await this.db
      .select({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .where(
        and(
          eq(jobs.status, JobStatus.ACTIVE),
          gt(jobs.activatedAt, from),
          lte(jobs.activatedAt, to),
        ),
      );
    return rows.flatMap((row) =>
      row.title ? [{ id: row.id, title: row.title }] : [],
    );
  }

  /**
   * Cosine similarity of every eligible candidate against each activated job, keeping the top
   * `maxPerCandidate` above `minScore` per candidate. Candidates who already applied to a job are
   * left out of it.
   */
  private async findMatches(jobIds: string[]): Promise<CandidateMatch[]> {
    const { rows } = await this.db.execute<CandidateMatch>(sql`
      SELECT "candidateId", "jobId", score
      FROM (
        SELECT
          ${candidateMatchEmbeddings.candidateId} AS "candidateId",
          ${jobMatchEmbeddings.jobId} AS "jobId",
          1 - (${candidateMatchEmbeddings.embedding} <=> ${jobMatchEmbeddings.embedding}) AS score,
          ROW_NUMBER() OVER (
            PARTITION BY ${candidateMatchEmbeddings.candidateId}
            ORDER BY ${candidateMatchEmbeddings.embedding} <=> ${jobMatchEmbeddings.embedding}
          ) AS "rank"
        FROM ${candidateMatchEmbeddings}
        INNER JOIN ${jobSeekerProfiles}
          ON ${jobSeekerProfiles.id} = ${candidateMatchEmbeddings.candidateId}
        CROSS JOIN ${jobMatchEmbeddings}
        WHERE ${inArray(jobMatchEmbeddings.jobId, jobIds)}
          AND ${jobSeekerProfiles.isProfileComplete} = true
          AND NOT EXISTS (
            SELECT 1 FROM ${submissions}
            WHERE ${submissions.candidateId} = ${candidateMatchEmbeddings.candidateId}
              AND ${submissions.jobId} = ${jobMatchEmbeddings.jobId}
          )
      ) ranked
      WHERE score >= ${jobRecommendationConfig.minScore}
        AND "rank" <= ${jobRecommendationConfig.maxPerCandidate}
    `);

    return [
      ...groupMatchesByCandidate(
        rows,
        jobRecommendationConfig.minPerCandidate,
      ).values(),
    ].flat();
  }

  /**
   * Saves every recommendation, and notifies only candidates who have not opted out. Opt-outs are
   * checked before anything is written. Emails go out after the commit, so an email is never sent
   * for a recommendation that failed to save. Re-running a pass skips recommendations already
   * saved, so nobody is told about the same job twice.
   */
  private async saveAndNotify(
    runId: string,
    matches: CandidateMatch[],
    activatedJobs: ActivatedJob[],
  ): Promise<number> {
    const titleByJobId = new Map(
      activatedJobs.map((job) => [job.id, job.title]),
    );
    const recipients = await this.findRecipients([
      ...new Set(matches.map((match) => match.candidateId)),
    ]);
    const optedOut = await this.preferences.optedOutUserIds(
      NotificationCategory.JOB_RECOMMENDATIONS,
      [...recipients.values()].map((recipient) => recipient.userId),
    );
    const rows = matches.map((match) => ({ ...match, runId }));

    const deliveries = await this.db.transaction(async (tx) => {
      const inserted: SavedRecommendation[] = [];
      for (const batch of chunk(rows, WRITE_BATCH_SIZE)) {
        inserted.push(
          ...(await tx
            .insert(jobRecommendations)
            .values(batch)
            .onConflictDoNothing()
            .returning({
              candidateId: jobRecommendations.candidateId,
              jobId: jobRecommendations.jobId,
            })),
        );
      }

      const notifiable = inserted.flatMap((row) => {
        const recipient = recipients.get(row.candidateId);
        const jobTitle = titleByJobId.get(row.jobId);
        return recipient && jobTitle && !optedOut.has(recipient.userId)
          ? [{ ...row, recipient, jobTitle }]
          : [];
      });
      await this.candidateNotifications.notifyJobRecommended(
        notifiable.map((delivery) => ({
          candidateId: delivery.candidateId,
          jobId: delivery.jobId,
          jobTitle: delivery.jobTitle,
        })),
        tx,
      );
      return notifiable;
    });

    await this.sendEmails(deliveries);
    return rows.length;
  }

  /** One email per candidate listing that candidate's new matches. A failed enqueue is logged, not
   *  rethrown: the recommendations are already saved, so a retry would never send the email. */
  private async sendEmails(deliveries: Delivery[]): Promise<void> {
    const byCandidate = new Map<string, Delivery[]>();
    for (const delivery of deliveries) {
      const existing = byCandidate.get(delivery.candidateId);
      if (existing) {
        existing.push(delivery);
      } else {
        byCandidate.set(delivery.candidateId, [delivery]);
      }
    }

    for (const [candidateId, candidateDeliveries] of byCandidate) {
      const { recipient } = candidateDeliveries[0];
      try {
        const unsubscribeUrl = await this.preferences.getUnsubscribeUrl(
          recipient.userId,
        );
        await this.notifications.sendJobRecommendationsEmail(recipient.email, {
          candidateName: recipient.fullName,
          jobs: candidateDeliveries.map((delivery) => ({
            id: delivery.jobId,
            title: delivery.jobTitle,
          })),
          unsubscribeUrl,
        });
      } catch (err) {
        this.logger.error(
          `Failed to email job recommendations to candidate ${candidateId}`,
          err,
        );
      }
    }
  }

  private async findRecipients(
    candidateIds: string[],
  ): Promise<Map<string, Recipient>> {
    const recipients = new Map<string, Recipient>();
    for (const batch of chunk(candidateIds, WRITE_BATCH_SIZE)) {
      const rows = await this.db
        .select({
          candidateId: jobSeekerProfiles.id,
          userId: users.id,
          email: users.email,
          fullName: jobSeekerProfiles.fullName,
        })
        .from(jobSeekerProfiles)
        .innerJoin(users, eq(users.id, jobSeekerProfiles.userId))
        .where(inArray(jobSeekerProfiles.id, batch));
      for (const row of rows) {
        recipients.set(row.candidateId, row);
      }
    }
    return recipients;
  }
}
