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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const email_queue_service_1 = require("../email/email-queue.service");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    configService;
    emailQueueService;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(configService, emailQueueService) {
        this.configService = configService;
        this.emailQueueService = emailQueueService;
    }
    async sendEmail(to, subject, body) {
        this.logger.log(`Sending email to ${to} with subject: "${subject}"`);
        this.logger.log(`Email body: ${body}`);
    }
    async sendVerificationEmail(to, token) {
        const frontendUrl = this.configService.get('frontendUrl');
        const link = `${frontendUrl}/employer/verify-email?token=${token}`;
        const year = new Date().getFullYear();
        await this.emailQueueService.enqueueEmail({
            to,
            subject: 'Verify your Gainday email',
            template: 'password-reset',
            context: {
                resetLink: link,
                year,
                expiryHours: 24,
            },
        });
        this.logger.log(`Verification email enqueued for ${to}`);
    }
    async sendPasswordResetEmail(to, token) {
        const frontendUrl = this.configService.get('frontendUrl');
        const link = `${frontendUrl}/employer/reset-password?token=${token}`;
        const year = new Date().getFullYear();
        await this.emailQueueService.enqueueEmail({
            to,
            subject: 'Reset your Gainday password',
            template: 'password-reset',
            context: {
                resetLink: link,
                year,
                expiryHours: 24,
            },
        });
        this.logger.log(`Password reset email enqueued for ${to}`);
    }
    async sendBatchNotification(employerEmail, candidateCount, jobTitle) {
        const appUrl = this.configService.get('email.appUrl');
        const year = new Date().getFullYear();
        await this.emailQueueService.enqueueEmail({
            to: employerEmail,
            subject: `New submissions for ${jobTitle}`,
            template: 'batch-submission-notification',
            context: {
                candidateCount,
                jobTitle,
                jobId: '',
                appUrl,
                year,
            },
        });
        this.logger.log(`Batch submission notification enqueued for ${employerEmail}`);
    }
    async sendScoringResultsEmail(candidateEmail, jobTitle, overallScore, categoryScores) {
        const appUrl = this.configService.get('email.appUrl');
        const dashboardUrl = `${appUrl}/dashboard`;
        const year = new Date().getFullYear();
        await this.emailQueueService.enqueueEmail({
            to: candidateEmail,
            subject: `Your work simulation results for ${jobTitle} are ready`,
            template: 'scoring-results',
            context: {
                jobTitle,
                overallScore,
                categoryScores,
                dashboardUrl,
                year,
            },
        });
        this.logger.log(`Scoring results email enqueued for ${candidateEmail}`);
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        email_queue_service_1.EmailQueueService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map