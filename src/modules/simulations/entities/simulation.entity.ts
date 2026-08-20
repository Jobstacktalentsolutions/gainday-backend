import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
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

@Entity('simulations')
export class Simulation extends BaseEntity {
  @OneToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @Column()
  jobId: string;

  @Column({ type: 'jsonb' })
  tasks: SimulationTask[];

  @Column({ default: 30 }) // minutes
  timeLimitMinutes: number;
}
