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
exports.JobsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const job_entity_1 = require("./entities/job.entity");
let JobsService = class JobsService {
    jobRepository;
    constructor(jobRepository) {
        this.jobRepository = jobRepository;
    }
    async createJob(employerId, jobData) {
        const job = this.jobRepository.create({
            ...jobData,
            employerId,
            status: job_entity_1.JobStatus.DRAFT,
        });
        return this.jobRepository.save(job);
    }
    async publishJob(jobId) {
        const job = await this.jobRepository.findOne({ where: { id: jobId } });
        if (!job) {
            throw new Error('Job not found');
        }
        job.status = job_entity_1.JobStatus.ACTIVE;
        return this.jobRepository.save(job);
    }
    async findAllActive() {
        return this.jobRepository.find({ where: { status: job_entity_1.JobStatus.ACTIVE } });
    }
    async findById(id) {
        return this.jobRepository.findOne({ where: { id } });
    }
    async findByEmployer(employerId) {
        return this.jobRepository.find({ where: { employerId } });
    }
};
exports.JobsService = JobsService;
exports.JobsService = JobsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], JobsService);
//# sourceMappingURL=jobs.service.js.map