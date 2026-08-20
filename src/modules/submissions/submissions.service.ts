import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission, SubmissionStatus, CandidateAnswer } from './entities/submission.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Job } from '../jobs/entities/job.entity';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectQueue('scoring') private readonly scoringQueue: Queue,
  ) {}

  async createSubmission(
    jobId: string,
    simulationId: string,
    candidateId?: string,
    guestInfo?: { fullName: string; email: string; phoneNumber?: string },
  ): Promise<Submission> {
    const submission = this.submissionRepository.create({
      jobId,
      simulationId,
      candidateId,
      guestInfo,
      status: SubmissionStatus.PENDING,
      startedAt: new Date(),
      answers: [],
    });
    return this.submissionRepository.save(submission);
  }

  async submitAnswers(submissionId: string, answers: CandidateAnswer[]): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({ where: { id: submissionId } });
    if (!submission) {
      throw new Error('Submission not found');
    }
    
    submission.answers = answers;
    submission.completedAt = new Date();
    submission.timeTakenSeconds = Math.floor(
      (submission.completedAt.getTime() - (submission.startedAt?.getTime() || submission.completedAt.getTime())) / 1000,
    );
    
    // Check if the user triggered any cheating warning, mock update
    // If flagged, status can be marked or flags appended
    
    return this.submissionRepository.save(submission);
  }

  async queueBatchScoring(jobId: string, delayMs: number): Promise<void> {
    // Schedule batch scoring when job deadline expires
    this.logger.log(`Queueing batch scoring for Job ID ${jobId} in ${delayMs}ms`);
    await this.scoringQueue.add(
      'batch-score-job',
      { jobId },
      { delay: delayMs, jobId: `batch-score-${jobId}` }, // prevents duplicate schedules for same job
    );
  }

  async findByJob(jobId: string): Promise<Submission[]> {
    return this.submissionRepository.find({
      where: { jobId },
      relations: ['candidate'],
    });
  }

  async findById(id: string): Promise<Submission | null> {
    return this.submissionRepository.findOne({
      where: { id },
      relations: ['job', 'simulation'],
    });
  }

  async unlockCandidate(submissionId: string): Promise<Submission> {
    const submission = await this.findById(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }
    submission.isUnlocked = true;
    return this.submissionRepository.save(submission);
  }
}
