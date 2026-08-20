import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from './entities/job.entity';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
  ) {}

  async createJob(employerId: string, jobData: Partial<Job>): Promise<Job> {
    const job = this.jobRepository.create({
      ...jobData,
      employerId,
      status: JobStatus.DRAFT,
    });
    return this.jobRepository.save(job);
  }

  async publishJob(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new Error('Job not found');
    }
    job.status = JobStatus.ACTIVE;
    return this.jobRepository.save(job);
  }

  async findAllActive(): Promise<Job[]> {
    return this.jobRepository.find({ where: { status: JobStatus.ACTIVE } });
  }

  async findById(id: string): Promise<Job | null> {
    return this.jobRepository.findOne({ where: { id } });
  }

  async findByEmployer(employerId: string): Promise<Job[]> {
    return this.jobRepository.find({ where: { employerId } });
  }
}
