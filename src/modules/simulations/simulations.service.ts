import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { simulations, Simulation, SimulationTask } from '../../db/schema';

@Injectable()
export class SimulationsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findByJobId(jobId: string): Promise<Simulation | null> {
    const [simulation] = await this.db
      .select()
      .from(simulations)
      .where(eq(simulations.jobId, jobId));
    return simulation ?? null;
  }

  async findById(id: string): Promise<Simulation | null> {
    const [simulation] = await this.db
      .select()
      .from(simulations)
      .where(eq(simulations.id, id));
    return simulation ?? null;
  }

  async updateSimulationTasks(
    simulationId: string,
    tasks: SimulationTask[],
  ): Promise<Simulation> {
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
