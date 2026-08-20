import { Repository } from 'typeorm';
import { Submission, CandidateAnswer } from './entities/submission.entity';
import { Queue } from 'bullmq';
export declare class SubmissionsService {
    private readonly submissionRepository;
    private readonly scoringQueue;
    private readonly logger;
    constructor(submissionRepository: Repository<Submission>, scoringQueue: Queue);
    createSubmission(jobId: string, simulationId: string, candidateId?: string, guestInfo?: {
        fullName: string;
        email: string;
        phoneNumber?: string;
    }): Promise<Submission>;
    submitAnswers(submissionId: string, answers: CandidateAnswer[]): Promise<Submission>;
    queueBatchScoring(jobId: string, delayMs: number): Promise<void>;
    findByJob(jobId: string): Promise<Submission[]>;
    findById(id: string): Promise<Submission | null>;
    unlockCandidate(submissionId: string): Promise<Submission>;
}
