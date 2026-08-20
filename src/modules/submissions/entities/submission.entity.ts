import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Job } from '../../jobs/entities/job.entity';
import { Simulation } from '../../simulations/entities/simulation.entity';

export enum SubmissionStatus {
  PENDING = 'PENDING',
  SCORING = 'SCORING',
  SCORED = 'SCORED',
  DISQUALIFIED = 'DISQUALIFIED',
}

export interface CandidateAnswer {
  taskId: string;
  responseBody: string; // text response or selected choices
  prioritizationOrder?: string[]; // array of task option ids
  prioritizationJustification?: string;
  timeSpentSeconds: number;
}

export interface CategoryScoreDetail {
  score: number;
  rationale: string;
  evidence: string;
}

@Entity('submissions')
export class Submission extends BaseEntity {
  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @Column()
  jobId: string;

  @ManyToOne(() => Simulation)
  @JoinColumn({ name: 'simulationId' })
  simulation: Simulation;

  @Column()
  simulationId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'candidateId' })
  candidate?: User;

  @Column({ nullable: true })
  candidateId?: string;

  // Guest details if candidateId is null
  @Column({ type: 'jsonb', nullable: true })
  guestInfo?: {
    fullName: string;
    email: string;
    phoneNumber?: string;
  };

  @Column({
    type: 'enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.PENDING,
  })
  status: SubmissionStatus;

  @Column({ type: 'jsonb', default: [] })
  answers: CandidateAnswer[];

  // Scoring results
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  overallScore?: number;

  @Column({ type: 'jsonb', nullable: true })
  categoryScores?: {
    problemSolving: CategoryScoreDetail;
    execution: CategoryScoreDetail;
    writtenCommunication: CategoryScoreDetail;
    domainAwareness: CategoryScoreDetail;
    prioritization: CategoryScoreDetail;
  };

  @Column({ type: 'integer', nullable: true })
  timeTakenSeconds?: number;

  // Anti-cheat tracking
  @Column({ default: false })
  isAntiCheatFlagged: boolean;

  @Column('simple-array', { nullable: true })
  antiCheatFlags?: string[]; // e.g. "TAB_SWITCH", "IDLE_LIMIT_EXCEEDED"

  @Column({ type: 'text', nullable: true })
  disqualificationReason?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;

  // Unlock state (whether employer has paid / unlocked this candidate)
  @Column({ default: false })
  isUnlocked: boolean;
}
