import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum UserRole {
  EMPLOYER = 'EMPLOYER',
  JOB_SEEKER = 'JOB_SEEKER',
  ADMIN = 'ADMIN',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password?: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ nullable: true })
  fullName?: string;

  // Employer specific fields
  @Column({ nullable: true })
  companyName?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  // Job Seeker specific fields: persistent capability scores
  // Rolling average scores can be stored here or in a separate table
  @Column({ type: 'jsonb', nullable: true })
  capabilityScores?: {
    [domain: string]: {
      score: number;
      updatedAt: string;
      categories: {
        problemSolving: number;
        execution: number;
        writtenCommunication: number;
        domainAwareness: number;
        prioritization: number;
      };
    };
  };

  @Column({ default: true })
  isActive: boolean;
}
