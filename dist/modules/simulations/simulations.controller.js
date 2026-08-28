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
exports.SimulationsController = void 0;
const common_1 = require("@nestjs/common");
const simulations_service_1 = require("./simulations.service");
const jobs_service_1 = require("../jobs/jobs.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const user_entity_1 = require("../users/entities/user.entity");
let SimulationsController = class SimulationsController {
    simulationsService;
    jobsService;
    constructor(simulationsService, jobsService) {
        this.simulationsService = simulationsService;
        this.jobsService = jobsService;
    }
    async getByJob(jobId) {
        return this.simulationsService.findByJobId(jobId);
    }
    async generateForJob(jobId, user) {
        const job = await this.jobsService.findById(jobId);
        if (!job) {
            throw new common_1.NotFoundException('Job not found');
        }
        if (user.role !== user_entity_1.UserRole.ADMIN && job.employerId !== user.id) {
            throw new common_1.ForbiddenException('You may only generate simulations for your own jobs');
        }
        return this.simulationsService.generateSimulation(job);
    }
    async updateTasks(id, body, user) {
        const simulation = await this.simulationsService.findById(id);
        if (!simulation) {
            throw new common_1.NotFoundException('Simulation not found');
        }
        const job = await this.jobsService.findById(simulation.jobId);
        if (!job) {
            throw new common_1.NotFoundException('Job not found');
        }
        if (user.role !== user_entity_1.UserRole.ADMIN && job.employerId !== user.id) {
            throw new common_1.ForbiddenException('You may only edit simulations for your own jobs');
        }
        return this.simulationsService.updateSimulationTasks(id, body.tasks);
    }
};
exports.SimulationsController = SimulationsController;
__decorate([
    (0, common_1.Get)('job/:jobId'),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SimulationsController.prototype, "getByJob", null);
__decorate([
    (0, common_1.Post)('job/:jobId/generate'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.EMPLOYER, user_entity_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('jobId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SimulationsController.prototype, "generateForJob", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.EMPLOYER, user_entity_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SimulationsController.prototype, "updateTasks", null);
exports.SimulationsController = SimulationsController = __decorate([
    (0, common_1.Controller)('simulations'),
    __metadata("design:paramtypes", [simulations_service_1.SimulationsService,
        jobs_service_1.JobsService])
], SimulationsController);
//# sourceMappingURL=simulations.controller.js.map