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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const payments_service_1 = require("./payments.service");
const submissions_service_1 = require("../submissions/submissions.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const user_entity_1 = require("../users/entities/user.entity");
let PaymentsController = class PaymentsController {
    paymentsService;
    submissionsService;
    constructor(paymentsService, submissionsService) {
        this.paymentsService = paymentsService;
        this.submissionsService = submissionsService;
    }
    async getQuote(count) {
        const parsedCount = parseInt(count || '1', 10);
        return this.paymentsService.calculateQuote(parsedCount);
    }
    async checkout(body, user) {
        if (user.role !== user_entity_1.UserRole.ADMIN) {
            for (const submissionId of body.candidateIds) {
                const submission = await this.submissionsService.findById(submissionId);
                if (!submission) {
                    throw new common_1.NotFoundException(`Submission ${submissionId} not found`);
                }
                if (submission.job.employerId !== user.id) {
                    throw new common_1.ForbiddenException('You may only unlock candidates for your own jobs');
                }
            }
        }
        return this.paymentsService.processUnlockCheckout(body.candidateIds);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Get)('quote'),
    __param(0, (0, common_1.Query)('candidates')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getQuote", null);
__decorate([
    (0, common_1.Post)('checkout'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "checkout", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.Controller)('payments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.EMPLOYER, user_entity_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService,
        submissions_service_1.SubmissionsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map