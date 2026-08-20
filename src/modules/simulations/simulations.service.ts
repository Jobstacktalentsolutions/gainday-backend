import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Simulation, SimulationTask } from './entities/simulation.entity';
import { Job } from '../jobs/entities/job.entity';

@Injectable()
export class SimulationsService {
  constructor(
    @InjectRepository(Simulation)
    private readonly simulationRepository: Repository<Simulation>,
  ) {}

  async generateSimulation(job: Job): Promise<Simulation> {
    // Generate role-specific work simulation mock based on Job Details
    const tasks: SimulationTask[] = [
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

  async findByJobId(jobId: string): Promise<Simulation | null> {
    return this.simulationRepository.findOne({ where: { jobId } });
  }

  async updateSimulationTasks(simulationId: string, tasks: SimulationTask[]): Promise<Simulation> {
    const simulation = await this.simulationRepository.findOne({ where: { id: simulationId } });
    if (!simulation) {
      throw new Error('Simulation not found');
    }
    simulation.tasks = tasks;
    return this.simulationRepository.save(simulation);
  }
}
