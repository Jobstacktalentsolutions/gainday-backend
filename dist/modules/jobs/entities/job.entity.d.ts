import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
export declare enum JobStatus {
    DRAFT = "DRAFT",
    ACTIVE = "ACTIVE",
    UNDER_REVIEW = "UNDER_REVIEW",
    SHORTLIST_READY = "SHORTLIST_READY",
    CLOSED = "CLOSED"
}
export declare class Job extends BaseEntity {
    title: string;
    description: string;
    requiredSkills: string[];
    roleCategory: string;
    location: string;
    employmentType: string;
    salaryRange: {
        min: number;
        max: number;
        currency: string;
    };
    applicationDeadline: Date;
    businessProblem: string;
    status: JobStatus;
    employer: User;
    employerId: string;
}
