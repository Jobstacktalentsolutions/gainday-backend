import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Job } from '../../jobs/entities/job.entity';
import { Simulation } from '../../simulations/entities/simulation.entity';
export declare enum SubmissionStatus {
    PENDING = "PENDING",
    SCORING = "SCORING",
    SCORED = "SCORED",
    DISQUALIFIED = "DISQUALIFIED"
}
export interface CandidateAnswer {
    taskId: string;
    responseBody: string;
    prioritizationOrder?: string[];
    prioritizationJustification?: string;
    timeSpentSeconds: number;
}
export interface CategoryScoreDetail {
    score: number;
    rationale: string;
    evidence: string;
}
export declare class Submission extends BaseEntity {
    job: Job;
    jobId: string;
    simulation: Simulation;
    simulationId: string;
    candidate?: User;
    candidateId?: string;
    guestInfo?: {
        fullName: string;
        email: string;
        phoneNumber?: string;
    };
    status: SubmissionStatus;
    answers: CandidateAnswer[];
    overallScore?: number;
    categoryScores?: {
        problemSolving: CategoryScoreDetail;
        execution: CategoryScoreDetail;
        writtenCommunication: CategoryScoreDetail;
        domainAwareness: CategoryScoreDetail;
        prioritization: CategoryScoreDetail;
    };
    timeTakenSeconds?: number;
    isAntiCheatFlagged: boolean;
    antiCheatFlags?: string[];
    disqualificationReason?: string;
    startedAt?: Date;
    completedAt?: Date;
    isUnlocked: boolean;
}
