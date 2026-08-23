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
var EmailQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailQueueService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
let EmailQueueService = EmailQueueService_1 = class EmailQueueService {
    emailQueue;
    logger = new common_1.Logger(EmailQueueService_1.name);
    constructor(emailQueue) {
        this.emailQueue = emailQueue;
    }
    async enqueueEmail(payload, delayMs) {
        try {
            const job = await this.emailQueue.add('default', payload, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                delay: delayMs,
                removeOnComplete: true,
                removeOnFail: false,
            });
            this.logger.log(`Email job enqueued with ID: ${job.id}`);
            return (job.id || '').toString();
        }
        catch (error) {
            this.logger.error(`Failed to enqueue email:`, error);
            throw error;
        }
    }
    async enqueueBatchEmail(recipients, subject, template, context, delayMs) {
        try {
            const job = await this.emailQueue.add('batch', {
                recipients,
                subject,
                template,
                context,
            }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                delay: delayMs,
                removeOnComplete: true,
                removeOnFail: false,
            });
            this.logger.log(`Batch email job enqueued with ID: ${job.id} for ${recipients.length} recipients`);
            return (job.id || '').toString();
        }
        catch (error) {
            this.logger.error(`Failed to enqueue batch email:`, error);
            throw error;
        }
    }
    async getJobStatus(jobId) {
        try {
            const job = await this.emailQueue.getJob(jobId);
            if (!job) {
                return null;
            }
            return {
                id: job.id,
                state: await job.getState(),
                data: job.data,
                result: job.returnvalue,
                failedReason: job.failedReason,
                attempts: job.attemptsMade,
                delay: job.delay,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get job status:`, error);
            throw error;
        }
    }
};
exports.EmailQueueService = EmailQueueService;
exports.EmailQueueService = EmailQueueService = EmailQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('email')),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], EmailQueueService);
//# sourceMappingURL=email-queue.service.js.map