/**
 * Sends one job-recommendation notification to a single account, so the in-app notification, the
 * email, and its unsubscribe link can be checked end to end. The job is picked at random from the
 * active jobs (three at a time). No recommendation, pass record, or other user is touched.
 *
 * Email goes straight through Brevo rather than the BullMQ queue, so no Redis or running worker is
 * needed. Run with: pnpm recs:send-test -- --email someone@example.com
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { ConfigService } from '@nestjs/config';
import { and, eq, isNotNull } from 'drizzle-orm';
import configuration from '../../config/configuration';
import { createDb, createDbPool } from '../../db/client';
import {
  candidateNotifications,
  CandidateNotificationType,
  JobStatus,
  jobSeekerProfiles,
  jobs,
  users,
} from '../../db/schema';
import { EmailService } from '../email/email.service';
import { buildJobRecommendationsEmail } from '../notifications/job-recommendation-email';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';

const SAMPLE_SIZE = 3;

function emailArgument(): string {
  const index = process.argv.indexOf('--email');
  const email = index === -1 ? undefined : process.argv[index + 1];
  if (!email) {
    throw new Error(
      'Pass the recipient: pnpm recs:send-test -- --email someone@example.com',
    );
  }
  return email;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const email = emailArgument();
  const config = new ConfigService(configuration());
  const appUrl = config.getOrThrow<string>('email.appUrl');

  const pool = createDbPool(process.env.DATABASE_URL);
  const db = createDb(pool);

  try {
    const [recipient] = await db
      .select({
        userId: users.id,
        candidateId: jobSeekerProfiles.id,
        fullName: jobSeekerProfiles.fullName,
      })
      .from(users)
      .innerJoin(jobSeekerProfiles, eq(jobSeekerProfiles.userId, users.id))
      .where(eq(users.email, email));
    if (!recipient) {
      throw new Error(`No candidate profile for ${email}`);
    }

    const activeJobs = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        location: jobs.location,
        isRemoteFriendly: jobs.isRemoteFriendly,
        description: jobs.description,
      })
      .from(jobs)
      .where(and(eq(jobs.status, JobStatus.ACTIVE), isNotNull(jobs.title)));
    if (activeJobs.length === 0) {
      throw new Error('No active job with a title to attach');
    }
    const sampled = [...activeJobs]
      .sort(() => Math.random() - 0.5)
      .slice(0, SAMPLE_SIZE)
      .flatMap((job) => (job.title ? [{ ...job, title: job.title }] : []));

    const preferences = new NotificationPreferencesService(db, config);
    const unsubscribeUrl = await preferences.getUnsubscribeUrl(
      recipient.userId,
    );

    for (const job of sampled) {
      await db.insert(candidateNotifications).values({
        candidateId: recipient.candidateId,
        type: CandidateNotificationType.JOB_RECOMMENDATION,
        title: `New job match: ${job.title}`,
        message: `${job.title} matches the job title on your profile.`,
        metadata: { jobId: job.id },
      });
    }

    const emailService = new EmailService(config);
    const built = buildJobRecommendationsEmail({
      appUrl,
      candidateName: recipient.fullName,
      jobs: sampled,
      unsubscribeUrl,
      year: new Date().getFullYear(),
    });
    await emailService.sendEmail({
      to: email,
      subject: built.subject,
      template: 'job-recommendations',
      context: built.context,
    });

    console.log(`Sent to ${email}:`);
    for (const job of sampled) {
      console.log(`  - ${job.title}`);
    }
    console.log(`Unsubscribe link: ${unsubscribeUrl}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Test send failed:', err.message);
  process.exit(1);
});
