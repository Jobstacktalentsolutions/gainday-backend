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
exports.SubmissionsController = void 0;
const common_1 = require("@nestjs/common");
const submissions_service_1 = require("./submissions.service");
const jobs_service_1 = require("../jobs/jobs.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const optional_jwt_auth_guard_1 = require("../auth/guards/optional-jwt-auth.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const user_entity_1 = require("../users/entities/user.entity");
let SubmissionsController = class SubmissionsController {
    submissionsService;
    jobsService;
    constructor(submissionsService, jobsService) {
        this.submissionsService = submissionsService;
        this.jobsService = jobsService;
    }
    async startSimulation(jobId, body, user) {
        return this.submissionsService.createSubmission(jobId, body.simulationId, user?.id, body.guestInfo);
    }
    async submitSimulation(id, body) {
        return this.submissionsService.submitAnswers(id, body.answers);
    }
    async getSubmissionsByJob(jobId, user) {
        const job = await this.jobsService.findById(jobId);
        if (!job) {
            throw new common_1.NotFoundException('Job not found');
        }
        if (user.role !== user_entity_1.UserRole.ADMIN && job.employerId !== user.id) {
            throw new common_1.ForbiddenException('You may only view submissions for your own jobs');
        }
        return this.submissionsService.findByJob(jobId);
    }
    async getSubmissionById(id, user) {
        const submission = await this.submissionsService.findById(id);
        if (!submission) {
            throw new common_1.NotFoundException('Submission not found');
        }
        if (user.role !== user_entity_1.UserRole.ADMIN && submission.job.employerId !== user.id) {
            throw new common_1.ForbiddenException('You may only view submissions for your own jobs');
        }
        return submission;
    }
    async unlockSubmission(id, user) {
        const submission = await this.submissionsService.findById(id);
        if (!submission) {
            throw new common_1.NotFoundException('Submission not found');
        }
        if (user.role !== user_entity_1.UserRole.ADMIN && submission.job.employerId !== user.id) {
            throw new common_1.ForbiddenException('You may only unlock submissions for your own jobs');
        }
        return this.submissionsService.unlockCandidate(id);
    }
};
exports.SubmissionsController = SubmissionsController;
__decorate([
    (0, common_1.Post)('job/:jobId/start'),
    (0, common_1.UseGuards)(optional_jwt_auth_guard_1.OptionalJwtAuthGuard),
    __param(0, (0, common_1.Param)('jobId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SubmissionsController.prototype, "startSimulation", null);
__decorate([
    (0, common_1.Put)(':id/submit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SubmissionsController.prototype, "submitSimulation", null);
__decorate([
    (0, common_1.Get)('job/:jobId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.EMPLOYER, user_entity_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('jobId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SubmissionsController.prototype, "getSubmissionsByJob", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.EMPLOYER, user_entity_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SubmissionsController.prototype, "getSubmissionById", null);
__decorate([
    (0, common_1.Put)(':id/unlock'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.EMPLOYER, user_entity_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SubmissionsController.prototype, "unlockSubmission", null);
exports.SubmissionsController = SubmissionsController = __decorate([
    (0, common_1.Controller)('submissions'),
    __metadata("design:paramtypes", [submissions_service_1.SubmissionsService,
        jobs_service_1.JobsService])
], SubmissionsController);
//# sourceMappingURL=submissions.controller.js.map