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
exports.SimulationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const simulation_entity_1 = require("./entities/simulation.entity");
let SimulationsService = class SimulationsService {
    simulationRepository;
    constructor(simulationRepository) {
        this.simulationRepository = simulationRepository;
    }
    async generateSimulation(job) {
        const tasks = [
            {
                id: 'task-1',
                type: 'TRIAGE_PRIORITIZATION',
                title: 'Triage & Prioritize Client Requests',
                scenarioDescription: 'You have just started your shift. You receive four high-priority emails from different stakeholders.',
                questionPrompt: 'Rank these emails from 1 (highest priority) to 4 (lowest priority) and justify your ranking.',
                optionsToPrioritize: [
                    { id: 'opt-1', title: 'Urgent Wire Transfer Request', description: 'Client demands an immediate wire transfer validation.' },
                    { id: 'opt-2', title: 'Q2 Reports Discrepancy', description: 'Internal audit found a minor calculation error in your team\'s Q2 reports.' },
                    { id: 'opt-3', title: 'Lunch Scheduling', description: 'Manager wants to schedule a lunch date next week.' },
                    { id: 'opt-4', title: 'Prospect inquiry', description: 'New client asking for capability brochure.' },
                ],
                businessProblemDerived: false,
            },
            {
                id: 'task-2',
                type: 'INTERPRET_SUMMARIZE',
                title: `Addressing Business Challenge: ${job.title}`,
                scenarioDescription: `Here is the challenge you need to solve: ${job.businessProblem}`,
                questionPrompt: 'Write a summary report (under 250 words) outlining your proposed approach and primary recommendations.',
                wordLimit: 250,
                businessProblemDerived: true,
            },
            {
                id: 'task-3',
                type: 'STAKEHOLDER_RESPONSE',
                title: 'Stakeholder Pushback',
                scenarioDescription: 'The senior partner rejects your recommendation from Task 2, citing budget limitations.',
                questionPrompt: 'Draft your email reply to the partner proposing a compromise or defending your plan constructively.',
                wordLimit: 150,
                businessProblemDerived: false,
            },
        ];
        const simulation = this.simulationRepository.create({
            jobId: job.id,
            tasks,
            timeLimitMinutes: 30,
        });
        return this.simulationRepository.save(simulation);
    }
    async findByJobId(jobId) {
        return this.simulationRepository.findOne({ where: { jobId } });
    }
    async findById(id) {
        return this.simulationRepository.findOne({ where: { id } });
    }
    async updateSimulationTasks(simulationId, tasks) {
        const simulation = await this.simulationRepository.findOne({ where: { id: simulationId } });
        if (!simulation) {
            throw new Error('Simulation not found');
        }
        simulation.tasks = tasks;
        return this.simulationRepository.save(simulation);
    }
};
exports.SimulationsService = SimulationsService;
exports.SimulationsService = SimulationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(simulation_entity_1.Simulation)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SimulationsService);
//# sourceMappingURL=simulations.service.js.map