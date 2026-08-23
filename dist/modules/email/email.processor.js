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
var EmailProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const email_service_1 = require("./email.service");
let EmailProcessor = EmailProcessor_1 = class EmailProcessor extends bullmq_1.WorkerHost {
    emailService;
    logger = new common_1.Logger(EmailProcessor_1.name);
    constructor(emailService) {
        super();
        this.emailService = emailService;
    }
    async process(job) {
        try {
            this.logger.debug(`Processing email job ${job.id}`);
            if ('recipients' in job.data) {
                const { recipients, subject, template, context } = job.data;
                await this.emailService.sendBatchEmail(recipients, subject, template, context);
                this.logger.log(`Batch email job ${job.id} completed successfully`);
                return { success: true, jobId: job.id, recipientCount: recipients.length };
            }
            else {
                const { template, subject, to, context, replyTo, cc, bcc } = job.data;
                await this.emailService.sendEmail({
                    to,
                    subject,
                    template,
                    context,
                    replyTo,
                    cc,
                    bcc,
                });
                this.logger.log(`Email job ${job.id} completed successfully`);
                return { success: true, jobId: job.id };
            }
        }
        catch (error) {
            this.logger.error(`Email job ${job.id} failed:`, error);
            throw error;
        }
    }
};
exports.EmailProcessor = EmailProcessor;
exports.EmailProcessor = EmailProcessor = EmailProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('email'),
    __metadata("design:paramtypes", [email_service_1.EmailService])
], EmailProcessor);
//# sourceMappingURL=email.processor.js.map