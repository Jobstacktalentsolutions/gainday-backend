import { SubmissionsService } from './submissions.service';
export declare class SubmissionsController {
    private readonly submissionsService;
    constructor(submissionsService: SubmissionsService);
    startSimulation(jobId: string, body: {
        simulationId: string;
        guestInfo?: any;
    }, req: any): Promise<import("./entities/submission.entity").Submission>;
    submitSimulation(id: string, body: {
        answers: any[];
    }): Promise<import("./entities/submission.entity").Submission>;
    getSubmissionsByJob(jobId: string): Promise<import("./entities/submission.entity").Submission[]>;
    getSubmissionById(id: string): Promise<import("./entities/submission.entity").Submission | null>;
    unlockSubmission(id: string): Promise<import("./entities/submission.entity").Submission>;
}
