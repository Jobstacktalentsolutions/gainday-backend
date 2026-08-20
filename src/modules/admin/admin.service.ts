import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Job, JobStatus } from '../jobs/entities/job.entity';
import { Submission, SubmissionStatus } from '../submissions/entities/submission.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
  ) {}

  async getAdminStats() {
    const activeJobs = await this.jobRepository.count({ where: { status: JobStatus.ACTIVE } });
    const totalUsers = await this.userRepository.count();
    const openSubmissions = await this.submissionRepository.count({ where: { status: SubmissionStatus.PENDING } });
    
    return {
      activeJobs,
      totalUsers,
      openSubmissions,
      jobsFilled: await this.jobRepository.count({ where: { status: JobStatus.CLOSED } }),
    };
  }

  async setUserActiveStatus(userId: string, isActive: boolean): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    user.isActive = isActive;
    return this.userRepository.save(user);
  }

  async reviewAntiCheatFlag(submissionId: string, action: 'UPHOLD' | 'OVERTURN'): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({ where: { id: submissionId } });
    if (!submission) {
      throw new Error('Submission not found');
    }

    if (action === 'UPHOLD') {
      submission.status = SubmissionStatus.DISQUALIFIED;
      submission.disqualificationReason = 'Anti-cheat violation confirmed by admin review.';
    } else {
      submission.status = SubmissionStatus.PENDING; // Re-enters scoring queue
      submission.isAntiCheatFlagged = false;
      // In production, trigger scoring job queue
    }

    return this.submissionRepository.save(submission);
  }

  async deleteInappropriateJob(jobId: string): Promise<void> {
    await this.jobRepository.delete(jobId);
  }
}
