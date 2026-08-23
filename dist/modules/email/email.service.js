"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ejs = __importStar(require("ejs"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const axios_1 = __importDefault(require("axios"));
let EmailService = EmailService_1 = class EmailService {
    configService;
    logger = new common_1.Logger(EmailService_1.name);
    apiKey;
    fromEmail;
    fromName;
    breevoApiUrl = 'https://api.brevo.com/v3/smtp/email';
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.configService.get('email.brevoApiKey', '');
        this.fromEmail = this.configService.get('email.fromEmail', 'noreply@gainday.com');
        this.fromName = this.configService.get('email.fromName', 'Gainday');
        if (!this.apiKey) {
            this.logger.warn('Brevo API key not configured');
        }
    }
    async renderTemplate(templateName, context = {}) {
        try {
            const templatePath = path.join(process.cwd(), 'src', 'templates', 'emails', `${templateName}.ejs`);
            if (!fs.existsSync(templatePath)) {
                throw new Error(`Email template not found: ${templatePath}`);
            }
            const html = await ejs.renderFile(templatePath, context, {
                async: true,
            });
            return html;
        }
        catch (error) {
            this.logger.error(`Failed to render template ${templateName}:`, error);
            throw error;
        }
    }
    async sendEmail(payload) {
        try {
            const html = await this.renderTemplate(payload.template, payload.context);
            const toList = Array.isArray(payload.to)
                ? payload.to.map((email) => ({ email, name: '' }))
                : [{ email: payload.to, name: '' }];
            const emailData = {
                to: toList,
                subject: payload.subject,
                htmlContent: html,
                sender: {
                    name: this.fromName,
                    email: this.fromEmail,
                },
            };
            if (payload.replyTo) {
                emailData.replyTo = { email: payload.replyTo };
            }
            if (payload.cc && payload.cc.length > 0) {
                emailData.cc = payload.cc.map((email) => ({ email }));
            }
            if (payload.bcc && payload.bcc.length > 0) {
                emailData.bcc = payload.bcc.map((email) => ({ email }));
            }
            await axios_1.default.post(this.breevoApiUrl, emailData, {
                headers: {
                    accept: 'application/json',
                    'api-key': this.apiKey,
                    'content-type': 'application/json',
                },
            });
            this.logger.log(`Email sent successfully to ${Array.isArray(payload.to) ? payload.to.join(', ') : payload.to}`);
        }
        catch (error) {
            this.logger.error(`Failed to send email:`, error);
            throw error;
        }
    }
    async sendBatchEmail(recipients, subject, template, context = {}) {
        try {
            const html = await this.renderTemplate(template, context);
            const toList = recipients.map((email) => ({ email, name: '' }));
            const emailData = {
                to: toList,
                subject,
                htmlContent: html,
                sender: {
                    name: this.fromName,
                    email: this.fromEmail,
                },
            };
            await axios_1.default.post(this.breevoApiUrl, emailData, {
                headers: {
                    accept: 'application/json',
                    'api-key': this.apiKey,
                    'content-type': 'application/json',
                },
            });
            this.logger.log(`Batch email sent to ${recipients.length} recipients`);
        }
        catch (error) {
            this.logger.error(`Failed to send batch email:`, error);
            throw error;
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map