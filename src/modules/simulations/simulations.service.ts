import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Embeddings } from '@langchain/core/embeddings';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  simulations,
  Simulation,
  SimulationTask,
  questionBank,
  QuestionBankTaskContent,
} from '../../db/schema';
import { EMBEDDINGS } from '../ai/ai.constants';
import { embedTaskContent } from '../generation/utils/embedding.util';

@Injectable()
export class SimulationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(EMBEDDINGS) private readonly embeddings: Embeddings,
  ) {}

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
    const existingSimulation = await this.findById(simulationId);
    if (!existingSimulation) {
      throw new Error('Simulation not found');
    }

    const updatedTasks: SimulationTask[] = [];
    for (const task of tasks) {
      if (task.questionBankId) {
        updatedTasks.push(task);
        continue;
      }

      const taskContent: QuestionBankTaskContent = {
        taskType: task.taskType,
        title: task.title,
        scenarioDescription: task.scenarioDescription,
        questionPrompt: task.questionPrompt,
        objectiveComponent: task.objectiveComponent,
        openEndedComponent: task.openEndedComponent,
        businessProblemDerived: task.businessProblemDerived,
        interfaceType: task.interfaceType,
        interfacePayload: task.interfacePayload,
      };

      const embedding = await embedTaskContent(this.embeddings, taskContent);

      let questionBankId: string;
      try {
        const [inserted] = await this.db
          .insert(questionBank)
          .values({
            category: task.category,
            intent: task.questionPrompt || task.title,
            taskType: task.taskType,
            taskContent,
            sourceJobId: existingSimulation.jobId,
            embedding,
          })
          .returning({ id: questionBank.id });
        questionBankId = inserted.id;
      } catch (err) {
        if (err instanceof Error) {
          err.message = err.message.replace(
            /\[-?\d+\.\d+(?:,-?\d+\.\d+){10,}\]/g,
            '[embedding omitted]',
          );
        }
        throw err;
      }

      updatedTasks.push({
        ...task,
        questionBankId,
      });
    }

    const [simulation] = await this.db
      .update(simulations)
      .set({ tasks: updatedTasks, updatedAt: new Date() })
      .where(eq(simulations.id, simulationId))
      .returning();

    if (!simulation) {
      throw new Error('Simulation not found');
    }
    return simulation;
  }
}
