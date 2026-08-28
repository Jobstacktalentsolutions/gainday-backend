import { Repository } from 'typeorm';
import { Simulation, SimulationTask } from './entities/simulation.entity';
import { Job } from '../jobs/entities/job.entity';
export declare class SimulationsService {
    private readonly simulationRepository;
    constructor(simulationRepository: Repository<Simulation>);
    generateSimulation(job: Job): Promise<Simulation>;
    findByJobId(jobId: string): Promise<Simulation | null>;
    findById(id: string): Promise<Simulation | null>;
    updateSimulationTasks(simulationId: string, tasks: SimulationTask[]): Promise<Simulation>;
}
