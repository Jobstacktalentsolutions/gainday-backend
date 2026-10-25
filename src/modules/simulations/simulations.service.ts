import { isDeepStrictEqual } from 'util';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
import { RoleRegistry } from '../generation/roles/role-registry';

@Injectable()
export class SimulationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(EMBEDDINGS) private readonly embeddings: Embeddings,
    private readonly roleRegistry: RoleRegistry,
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

  private isFigureBased(task: SimulationTask): boolean {
    let roleModule;
    try {
      roleModule = this.roleRegistry.resolve(task.category);
    } catch {
      return false;
    }
    return (
      roleModule.allowedTaskPatternTypes.find((t) => t.key === task.taskType)?.spec !==
      undefined
    );
  }

  /**
   * A figure-based task's table and answer key are derived from its inputs at generation (finance
   * doc Section 6.2), so an employer edit may change the wording but never the figures. The wording
   * is held to the same figure rule as generation, so it cannot quote a number the table lacks.
   */
  private lockFigures(task: SimulationTask, stored: SimulationTask | undefined): SimulationTask {
    if (!this.isFigureBased(task)) return task;
    if (!stored) {
      throw new BadRequestException(`"${task.title}" is not a task of this simulation`);
    }
    const figuresChanged =
      task.interfaceType !== stored.interfaceType ||
      !isDeepStrictEqual(task.interfacePayload, stored.interfacePayload) ||
      !isDeepStrictEqual(task.objectiveComponent, stored.objectiveComponent) ||
      !isDeepStrictEqual(task.rubric, stored.rubric);
    if (figuresChanged) {
      throw new BadRequestException(
        `"${task.title}" is generated from figures and cannot be edited — regenerate the task to change them`,
      );
    }

    const roleModule = this.roleRegistry.resolve(task.category);
    const reasons =
      roleModule.criticChecks.validateTask?.({
        taskType: task.taskType,
        taskContent: {
          taskType: task.taskType,
          title: task.title,
          scenarioDescription: task.scenarioDescription,
          questionPrompt: task.questionPrompt,
          openEndedComponent: task.openEndedComponent,
          businessProblemDerived: task.businessProblemDerived,
          interfaceType: task.interfaceType,
          interfacePayload: task.interfacePayload,
        },
      }) ?? [];
    if (reasons.length > 0) {
      throw new BadRequestException(`"${task.title}": ${reasons.join(' ')}`);
    }
    return task;
  }

  async updateSimulationTasks(
    simulationId: string,
    tasks: SimulationTask[],
  ): Promise<Simulation> {
    if (tasks.length > 4) {
      throw new BadRequestException('A simulation may have at most 4 tasks');
    }

    const existingSimulation = await this.findById(simulationId);
    if (!existingSimulation) {
      throw new Error('Simulation not found');
    }

    const storedTasks = new Map(existingSimulation.tasks.map((t) => [t.id, t]));
    const updatedTasks: SimulationTask[] = [];
    for (const task of tasks) {
      if (task.questionBankId) {
        updatedTasks.push(this.lockFigures(task, storedTasks.get(task.id)));
        continue;
      }
      if (this.isFigureBased(task)) {
        throw new BadRequestException(
          `"${task.title}" is a figure-based task and cannot be written by hand — regenerate it instead`,
        );
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
