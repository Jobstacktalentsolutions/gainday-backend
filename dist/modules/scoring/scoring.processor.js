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
var ScoringProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const submission_entity_1 = require("../submissions/entities/submission.entity");
const job_entity_1 = require("../jobs/entities/job.entity");
const scoring_service_1 = require("./scoring.service");
const notifications_service_1 = require("../notifications/notifications.service");
const users_service_1 = require("../users/users.service");
let ScoringProcessor = ScoringProcessor_1 = class ScoringProcessor extends bullmq_1.WorkerHost {
    submissionRepository;
    jobRepository;
    scoringService;
    usersService;
    notificationsService;
    logger = new common_1.Logger(ScoringProcessor_1.name);
    constructor(submissionRepository, jobRepository, scoringService, usersService, notificationsService) {
        super();
        this.submissionRepository = submissionRepository;
        this.jobRepository = jobRepository;
        this.scoringService = scoringService;
        this.usersService = usersService;
        this.notificationsService = notificationsService;
    }
    async process(bullJob) {
        const { jobId } = bullJob.data;
        this.logger.log(`Processing batch scoring for Job ID: ${jobId}`);
        const job = await this.jobRepository.findOne({ where: { id: jobId }, relations: ['employer'] });
        if (!job) {
            throw new Error(`Job not found: ${jobId}`);
        }
        job.status = job_entity_1.JobStatus.UNDER_REVIEW;
        await this.jobRepository.save(job);
        const submissions = await this.submissionRepository.find({
            where: { jobId, status: submission_entity_1.SubmissionStatus.PENDING },
            relations: ['simulation'],
        });
        this.logger.log(`Found ${submissions.length} submissions to score for Job ID: ${jobId}`);
        let processedCount = 0;
        for (const submission of submissions) {
            try {
                submission.status = submission_entity_1.SubmissionStatus.SCORING;
                await this.submissionRepository.save(submission);
                const scoreResults = await this.scoringService.scoreSubmission(submission);
                Object.assign(submission, scoreResults);
                await this.submissionRepository.save(submission);
                if (submission.candidateId && submission.overallScore) {
                    await this.usersService.updateUserCapabilityScores(submission.candidateId, job.roleCategory, {
                        score: submission.overallScore,
                        categories: {
                            problemSolving: submission.categoryScores?.problemSolving?.score || 0,
                            execution: submission.categoryScores?.execution?.score || 0,
                            writtenCommunication: submission.categoryScores?.writtenCommunication?.score || 0,
                            domainAwareness: submission.categoryScores?.domainAwareness?.score || 0,
                            prioritization: submission.categoryScores?.prioritization?.score || 0,
                        },
                    });
                }
                const candidateEmail = submission.candidate?.email || submission.guestInfo?.email;
                if (candidateEmail && submission.overallScore !== undefined) {
                    await this.notificationsService.sendScoringResultsEmail(candidateEmail, job.title, submission.overallScore, submission.categoryScores
                        ? {
                            problemSolving: submission.categoryScores.problemSolving?.score || 0,
                            execution: submission.categoryScores.execution?.score || 0,
                            writtenCommunication: submission.categoryScores.writtenCommunication?.score || 0,
                            domainAwareness: submission.categoryScores.domainAwareness?.score || 0,
                            prioritization: submission.categoryScores.prioritization?.score || 0,
                        }
                        : undefined);
                }
                processedCount++;
            }
            catch (err) {
                this.logger.error(`Error scoring submission ${submission.id}:`, err);
            }
        }
        job.status = job_entity_1.JobStatus.SHORTLIST_READY;
        await this.jobRepository.save(job);
        if (job.employer?.email && processedCount > 0) {
            await this.notificationsService.sendBatchNotification(job.employer.email, processedCount, job.title);
        }
        return { processedCount };
    }
};
exports.ScoringProcessor = ScoringProcessor;
exports.ScoringProcessor = ScoringProcessor = ScoringProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('scoring'),
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __param(1, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        scoring_service_1.ScoringService,
        users_service_1.UsersService,
        notifications_service_1.NotificationsService])
], ScoringProcessor);
//# sourceMappingURL=scoring.processor.js.map