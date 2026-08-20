import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
export declare class JobsService {
    private readonly jobRepository;
    constructor(jobRepository: Repository<Job>);
    createJob(employerId: string, jobData: Partial<Job>): Promise<Job>;
    publishJob(jobId: string): Promise<Job>;
    findAllActive(): Promise<Job[]>;
    findById(id: string): Promise<Job | null>;
    findByEmployer(employerId: string): Promise<Job[]>;
}
