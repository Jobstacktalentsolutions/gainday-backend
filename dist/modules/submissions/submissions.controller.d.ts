import { SubmissionsService } from './submissions.service';
import { JobsService } from '../jobs/jobs.service';
export declare class SubmissionsController {
    private readonly submissionsService;
    private readonly jobsService;
    constructor(submissionsService: SubmissionsService, jobsService: JobsService);
    startSimulation(jobId: string, body: {
        simulationId: string;
        guestInfo?: any;
    }, user: any): Promise<import("./entities/submission.entity").Submission>;
    submitSimulation(id: string, body: {
        answers: any[];
    }): Promise<import("./entities/submission.entity").Submission>;
    getSubmissionsByJob(jobId: string, user: any): Promise<import("./entities/submission.entity").Submission[]>;
    getSubmissionById(id: string, user: any): Promise<import("./entities/submission.entity").Submission>;
    unlockSubmission(id: string, user: any): Promise<import("./entities/submission.entity").Submission>;
}
