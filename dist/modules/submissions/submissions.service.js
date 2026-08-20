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
var SubmissionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const submission_entity_1 = require("./entities/submission.entity");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
let SubmissionsService = SubmissionsService_1 = class SubmissionsService {
    submissionRepository;
    scoringQueue;
    logger = new common_1.Logger(SubmissionsService_1.name);
    constructor(submissionRepository, scoringQueue) {
        this.submissionRepository = submissionRepository;
        this.scoringQueue = scoringQueue;
    }
    async createSubmission(jobId, simulationId, candidateId, guestInfo) {
        const submission = this.submissionRepository.create({
            jobId,
            simulationId,
            candidateId,
            guestInfo,
            status: submission_entity_1.SubmissionStatus.PENDING,
            startedAt: new Date(),
            answers: [],
        });
        return this.submissionRepository.save(submission);
    }
    async submitAnswers(submissionId, answers) {
        const submission = await this.submissionRepository.findOne({ where: { id: submissionId } });
        if (!submission) {
            throw new Error('Submission not found');
        }
        submission.answers = answers;
        submission.completedAt = new Date();
        submission.timeTakenSeconds = Math.floor((submission.completedAt.getTime() - (submission.startedAt?.getTime() || submission.completedAt.getTime())) / 1000);
        return this.submissionRepository.save(submission);
    }
    async queueBatchScoring(jobId, delayMs) {
        this.logger.log(`Queueing batch scoring for Job ID ${jobId} in ${delayMs}ms`);
        await this.scoringQueue.add('batch-score-job', { jobId }, { delay: delayMs, jobId: `batch-score-${jobId}` });
    }
    async findByJob(jobId) {
        return this.submissionRepository.find({
            where: { jobId },
            relations: ['candidate'],
        });
    }
    async findById(id) {
        return this.submissionRepository.findOne({
            where: { id },
            relations: ['job', 'simulation'],
        });
    }
    async unlockCandidate(submissionId) {
        const submission = await this.findById(submissionId);
        if (!submission) {
            throw new Error('Submission not found');
        }
        submission.isUnlocked = true;
        return this.submissionRepository.save(submission);
    }
};
exports.SubmissionsService = SubmissionsService;
exports.SubmissionsService = SubmissionsService = SubmissionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __param(1, (0, bullmq_1.InjectQueue)('scoring')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        bullmq_2.Queue])
], SubmissionsService);
//# sourceMappingURL=submissions.service.js.map