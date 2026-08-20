"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/entities/user.entity");
const job_entity_1 = require("../jobs/entities/job.entity");
const submission_entity_1 = require("../submissions/entities/submission.entity");
let AdminService = class AdminService {
    userRepository;
    jobRepository;
    submissionRepository;
    constructor(userRepository, jobRepository, submissionRepository) {
        this.userRepository = userRepository;
        this.jobRepository = jobRepository;
        this.submissionRepository = submissionRepository;
    }
    async getAdminStats() {
        const activeJobs = await this.jobRepository.count({ where: { status: job_entity_1.JobStatus.ACTIVE } });
        const totalUsers = await this.userRepository.count();
        const openSubmissions = await this.submissionRepository.count({ where: { status: submission_entity_1.SubmissionStatus.PENDING } });
        return {
            activeJobs,
            totalUsers,
            openSubmissions,
            jobsFilled: await this.jobRepository.count({ where: { status: job_entity_1.JobStatus.CLOSED } }),
        };
    }
    async setUserActiveStatus(userId, isActive) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        user.isActive = isActive;
        return this.userRepository.save(user);
    }
    async reviewAntiCheatFlag(submissionId, action) {
        const submission = await this.submissionRepository.findOne({ where: { id: submissionId } });
        if (!submission) {
            throw new Error('Submission not found');
        }
        if (action === 'UPHOLD') {
            submission.status = submission_entity_1.SubmissionStatus.DISQUALIFIED;
            submission.disqualificationReason = 'Anti-cheat violation confirmed by admin review.';
        }
        else {
            submission.status = submission_entity_1.SubmissionStatus.PENDING;
            submission.isAntiCheatFlagged = false;
        }
        return this.submissionRepository.save(submission);
    }
    async deleteInappropriateJob(jobId) {
        await this.jobRepository.delete(jobId);
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __param(2, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AdminService);
//# sourceMappingURL=admin.service.js.map