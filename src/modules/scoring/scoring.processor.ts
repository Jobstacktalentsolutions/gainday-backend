import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission, SubmissionStatus } from '../submissions/entities/submission.entity';
import { Job, JobStatus } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { ScoringService } from './scoring.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

@Processor('scoring')
@Injectable()
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly scoringService: ScoringService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(bullJob: BullJob<{ jobId: string }>): Promise<any> {
    const { jobId } = bullJob.data;
    this.logger.log(`Processing batch scoring for Job ID: ${jobId}`);

    // Fetch the job
    const job = await this.jobRepository.findOne({ where: { id: jobId }, relations: ['employer'] });
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Update job status to UNDER_REVIEW
    job.status = JobStatus.UNDER_REVIEW;
    await this.jobRepository.save(job);

    // Fetch all pending submissions for this job
    const submissions = await this.submissionRepository.find({
      where: { jobId, status: SubmissionStatus.PENDING },
      relations: ['simulation'],
    });

    this.logger.log(`Found ${submissions.length} submissions to score for Job ID: ${jobId}`);

    let processedCount = 0;
    for (const submission of submissions) {
      try {
        submission.status = SubmissionStatus.SCORING;
        await this.submissionRepository.save(submission);

        // Run LLM-as-judge scoring framework
        const scoreResults = await this.scoringService.scoreSubmission(submission);
        Object.assign(submission, scoreResults);
        await this.submissionRepository.save(submission);

        // Update candidate rolling Capability Score if user is logged in
        if (submission.candidateId && submission.overallScore) {
          await this.usersService.updateUserCapabilityScores(
            submission.candidateId,
            job.roleCategory,
            {
              score: submission.overallScore,
              categories: {
                problemSolving: submission.categoryScores?.problemSolving?.score || 0,
                execution: submission.categoryScores?.execution?.score || 0,
                writtenCommunication: submission.categoryScores?.writtenCommunication?.score || 0,
                domainAwareness: submission.categoryScores?.domainAwareness?.score || 0,
                prioritization: submission.categoryScores?.prioritization?.score || 0,
              },
            },
          );
        }

        // Email result notification to candidate
        const candidateEmail = submission.candidate?.email || submission.guestInfo?.email;
        if (candidateEmail) {
          await this.notificationsService.sendEmail(
            candidateEmail,
            `Your work simulation results for ${job.title} are ready`,
            `You scored ${submission.overallScore} overall. Log in to view detailed feedback across the five grading categories.`,
          );
        }

        processedCount++;
      } catch (err) {
        this.logger.error(`Error scoring submission ${submission.id}:`, err);
      }
    }

    // Update job status to SHORTLIST_READY once all submissions are scored
    job.status = JobStatus.SHORTLIST_READY;
    await this.jobRepository.save(job);

    // Send batch notification email to employer
    if (job.employer?.email && processedCount > 0) {
      await this.notificationsService.sendBatchNotification(
        job.employer.email,
        processedCount,
        job.title,
      );
    }

    return { processedCount };
  }
}
