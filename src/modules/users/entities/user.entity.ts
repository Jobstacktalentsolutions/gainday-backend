import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum UserRole {
  EMPLOYER = 'EMPLOYER',
  JOB_SEEKER = 'JOB_SEEKER',
  ADMIN = 'ADMIN',
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ select: false, nullable: true })
  password?: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  authProvider: AuthProvider;

  @Column({ nullable: true, unique: true })
  googleId?: string;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  companyName?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true, select: false })
  emailVerificationToken?: string;

  @Column({ type: 'timestamp with time zone', nullable: true, select: false })
  emailVerificationExpires?: Date;

  @Column({ nullable: true, select: false })
  passwordResetToken?: string;

  @Column({ type: 'timestamp with time zone', nullable: true, select: false })
  passwordResetExpires?: Date;

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
