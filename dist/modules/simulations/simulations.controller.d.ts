import { SimulationsService } from './simulations.service';
import { JobsService } from '../jobs/jobs.service';
export declare class SimulationsController {
    private readonly simulationsService;
    private readonly jobsService;
    constructor(simulationsService: SimulationsService, jobsService: JobsService);
    getByJob(jobId: string): Promise<import("./entities/simulation.entity").Simulation | null>;
    generateForJob(jobId: string, user: any): Promise<import("./entities/simulation.entity").Simulation>;
    updateTasks(id: string, body: {
        tasks: any[];
    }, user: any): Promise<import("./entities/simulation.entity").Simulation>;
}
