import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum JobStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  UNDER_REVIEW = 'UNDER_REVIEW',
  SHORTLIST_READY = 'SHORTLIST_READY',
  CLOSED = 'CLOSED',
}

@Entity('jobs')
export class Job extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column('simple-array')
  requiredSkills: string[];

  @Column()
  roleCategory: string; // Finance, etc.

  @Column()
  location: string;

  @Column()
  employmentType: string; // Full-time, Part-time, Contract

  @Column({ type: 'jsonb' })
  salaryRange: {
    min: number;
    max: number;
    currency: string;
  };

  @Column({ type: 'timestamp with time zone' })
  applicationDeadline: Date;

  @Column({ type: 'text' })
  businessProblem: string;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.DRAFT,
  })
  status: JobStatus;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employerId' })
  employer: User;

  @Column()
  employerId: string;
}
