import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import { DrizzleDb } from '../../db/client';
import { simulations, Simulation, SimulationTask } from '../../db/schema';
import { Job } from '../../db/schema';

@Injectable()
export class SimulationsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

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

    const [simulation] = await this.db
      .insert(simulations)
      .values({
        jobId: job.id,
        tasks,
        timeLimitMinutes: 30,
      })
      .returning();

    return simulation;
  }

  async findByJobId(jobId: string): Promise<Simulation | null> {
    const [simulation] = await this.db.select().from(simulations).where(eq(simulations.jobId, jobId));
    return simulation ?? null;
  }

  async findById(id: string): Promise<Simulation | null> {
    const [simulation] = await this.db.select().from(simulations).where(eq(simulations.id, id));
    return simulation ?? null;
  }

  async updateSimulationTasks(simulationId: string, tasks: SimulationTask[]): Promise<Simulation> {
    const [simulation] = await this.db
      .update(simulations)
      .set({ tasks, updatedAt: new Date() })
      .where(eq(simulations.id, simulationId))
      .returning();
    if (!simulation) {
      throw new Error('Simulation not found');
    }
    return simulation;
  }
}
