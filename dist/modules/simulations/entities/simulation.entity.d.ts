import { BaseEntity } from '../../../common/entities/base.entity';
import { Job } from '../../jobs/entities/job.entity';
export interface SimulationTask {
    id: string;
    type: 'TRIAGE_PRIORITIZATION' | 'INTERPRET_SUMMARIZE' | 'TRADE_OFF_DECISION' | 'STAKEHOLDER_RESPONSE';
    title: string;
    scenarioDescription: string;
    questionPrompt: string;
    wordLimit?: number;
    optionsToPrioritize?: Array<{
        id: string;
        title: string;
        description: string;
    }>;
    businessProblemDerived: boolean;
}
export declare class Simulation extends BaseEntity {
    job: Job;
    jobId: string;
    tasks: SimulationTask[];
    timeLimitMinutes: number;
}
