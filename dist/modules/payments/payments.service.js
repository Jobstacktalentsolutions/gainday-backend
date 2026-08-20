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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let PaymentsService = class PaymentsService {
    configService;
    pricePerCandidate = 50.0;
    constructor(configService) {
        this.configService = configService;
    }
    async calculateQuote(candidateCount) {
        const isFreeTierActive = this.configService.get('FREE_TIER_LAUNCH_ACTIVE') !== 'false';
        const totalAmount = isFreeTierActive ? 0.0 : this.pricePerCandidate * candidateCount;
        return {
            unitPrice: this.pricePerCandidate,
            totalAmount,
            currency: 'GBP',
            isFreeTierActive,
        };
    }
    async processUnlockCheckout(candidateIds) {
        const quote = await this.calculateQuote(candidateIds.length);
        const transactionId = `txn_${Math.random().toString(36).substring(2, 11)}`;
        return {
            success: true,
            transactionId,
            amountPaid: quote.totalAmount,
            unlockedCandidatesCount: candidateIds.length,
        };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map