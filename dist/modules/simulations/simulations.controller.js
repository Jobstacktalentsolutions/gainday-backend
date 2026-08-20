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
    async generateForJob(jobId) {
        const job = await this.jobsService.findById(jobId);
        if (!job) {
            throw new Error('Job not found');
        }
        return this.simulationsService.generateSimulation(job);
    }
    async updateTasks(id, body) {
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
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SimulationsController.prototype, "generateForJob", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SimulationsController.prototype, "updateTasks", null);
exports.SimulationsController = SimulationsController = __decorate([
    (0, common_1.Controller)('simulations'),
    __metadata("design:paramtypes", [simulations_service_1.SimulationsService,
        jobs_service_1.JobsService])
], SimulationsController);
//# sourceMappingURL=simulations.controller.js.map