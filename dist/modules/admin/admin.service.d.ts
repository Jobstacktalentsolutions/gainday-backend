import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Job } from '../jobs/entities/job.entity';
import { Submission } from '../submissions/entities/submission.entity';
export declare class AdminService {
    private readonly userRepository;
    private readonly jobRepository;
    private readonly submissionRepository;
    constructor(userRepository: Repository<User>, jobRepository: Repository<Job>, submissionRepository: Repository<Submission>);
    getAdminStats(): Promise<{
        activeJobs: number;
        totalUsers: number;
        openSubmissions: number;
        jobsFilled: number;
    }>;
    setUserActiveStatus(userId: string, isActive: boolean): Promise<User>;
    reviewAntiCheatFlag(submissionId: string, action: 'UPHOLD' | 'OVERTURN'): Promise<Submission>;
    deleteInappropriateJob(jobId: string): Promise<void>;
}
