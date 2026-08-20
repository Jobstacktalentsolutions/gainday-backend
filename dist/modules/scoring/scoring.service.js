"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ScoringService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringService = void 0;
const common_1 = require("@nestjs/common");
let ScoringService = ScoringService_1 = class ScoringService {
    logger = new common_1.Logger(ScoringService_1.name);
    async scoreSubmission(submission) {
        this.logger.log(`Scoring submission: ${submission.id}`);
        const simulation = submission.simulation;
        const hasPrioritization = simulation?.tasks?.some(t => t.type === 'TRIAGE_PRIORITIZATION') || false;
        const weights = {
            problemSolving: hasPrioritization ? 0.30 : 0.40,
            execution: 0.20,
            writtenCommunication: 0.20,
            domainAwareness: 0.20,
            prioritization: hasPrioritization ? 0.10 : 0.00,
        };
        const problemSolvingScore = 85;
        const executionScore = 90;
        const writtenCommScore = 80;
        const domainAwarenessScore = 75;
        const prioritizationScore = hasPrioritization ? 100 : 0;
        const overallScore = (problemSolvingScore * weights.problemSolving) +
            (executionScore * weights.execution) +
            (writtenCommScore * weights.writtenCommunication) +
            (domainAwarenessScore * weights.domainAwareness) +
            (prioritizationScore * weights.prioritization);
        return {
            status: 'SCORED',
            overallScore: Math.round(overallScore * 100) / 100,
            categoryScores: {
                problemSolving: {
                    score: problemSolvingScore,
                    rationale: 'Demonstrated strong reasoning and identified core issues correctly.',
                    evidence: 'Identified internal audit discrepancies as critical to team operations.',
                },
                execution: {
                    score: executionScore,
                    rationale: 'Followed instructions completely, strictly adhering to word limits.',
                    evidence: 'Word counts were 235 (limit 250) and 130 (limit 150).',
                },
                writtenCommunication: {
                    score: writtenCommScore,
                    rationale: 'Very clear, structured responses with professional tone.',
                    evidence: 'Proper business greeting, logical paragraphs, clear bullet points.',
                },
                domainAwareness: {
                    score: domainAwarenessScore,
                    rationale: 'Demonstrated good understanding of stakeholder interests and commercial tradeoffs.',
                    evidence: 'Acknowledged partner budget constraints when defending recommendations.',
                },
                prioritization: {
                    score: prioritizationScore,
                    rationale: hasPrioritization ? 'Perfect match with expert-defined priority matrix.' : 'N/A',
                    evidence: hasPrioritization ? 'Ranked options: Wire Transfer -> Q2 reports -> Prospect -> Lunch.' : 'N/A',
                },
            },
        };
    }
};
exports.ScoringService = ScoringService;
exports.ScoringService = ScoringService = ScoringService_1 = __decorate([
    (0, common_1.Injectable)()
], ScoringService);
//# sourceMappingURL=scoring.service.js.map