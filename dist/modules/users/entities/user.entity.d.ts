import { BaseEntity } from '../../../common/entities/base.entity';
export declare enum UserRole {
    EMPLOYER = "EMPLOYER",
    JOB_SEEKER = "JOB_SEEKER",
    ADMIN = "ADMIN"
}
export declare enum AuthProvider {
    LOCAL = "local",
    GOOGLE = "google"
}
export declare class User extends BaseEntity {
    email: string;
    password?: string;
    role: UserRole;
    authProvider: AuthProvider;
    googleId?: string;
    fullName?: string;
    companyName?: string;
    phoneNumber?: string;
    isEmailVerified: boolean;
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
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
    isActive: boolean;
}
