"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const scoring_service_1 = require("./scoring.service");
const scoring_processor_1 = require("./scoring.processor");
const submission_entity_1 = require("../submissions/entities/submission.entity");
const job_entity_1 = require("../jobs/entities/job.entity");
const users_module_1 = require("../users/users.module");
const notifications_module_1 = require("../notifications/notifications.module");
let ScoringModule = class ScoringModule {
};
exports.ScoringModule = ScoringModule;
exports.ScoringModule = ScoringModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([submission_entity_1.Submission, job_entity_1.Job]),
            users_module_1.UsersModule,
            notifications_module_1.NotificationsModule,
        ],
        providers: [scoring_service_1.ScoringService, scoring_processor_1.ScoringProcessor],
        exports: [scoring_service_1.ScoringService],
    })
], ScoringModule);
//# sourceMappingURL=scoring.module.js.map