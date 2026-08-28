import { JobsService } from './jobs.service';
export declare class JobsController {
    private readonly jobsService;
    constructor(jobsService: JobsService);
    getActiveJobs(): Promise<import("./entities/job.entity").Job[]>;
    getJobById(id: string): Promise<import("./entities/job.entity").Job | null>;
    createJob(user: any, body: any): Promise<import("./entities/job.entity").Job>;
    publishJob(id: string, user: any): Promise<import("./entities/job.entity").Job>;
}
