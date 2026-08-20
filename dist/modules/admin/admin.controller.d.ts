import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getStats(): Promise<{
        activeJobs: number;
        totalUsers: number;
        openSubmissions: number;
        jobsFilled: number;
    }>;
    setStatus(id: string, body: {
        isActive: boolean;
    }): Promise<import("../users/entities/user.entity").User>;
    reviewAntiCheat(id: string, body: {
        action: 'UPHOLD' | 'OVERTURN';
    }): Promise<import("../submissions/entities/submission.entity").Submission>;
    deleteJob(id: string): Promise<void>;
}
