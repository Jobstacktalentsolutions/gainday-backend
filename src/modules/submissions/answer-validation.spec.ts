import { InterfaceType } from '../generation/roles/interface-type';
import { BadRequestException } from '@nestjs/common';
import { SimulationTask } from '../../db/schema/simulations.schema';
import { RoleRegistry } from '../generation/roles/role-registry';
import { parseAnswers } from './answer-validation';

const registry = new RoleRegistry();

const reconciliationTask: SimulationTask = {
  id: 't1',
  questionBankId: 'q1',
  taskType: 'RECONCILIATION_CASH',
  category: 'Finance',
  title: 'Title',
  scenarioDescription: 'Scenario',
  questionPrompt: 'Prompt',
  objectiveComponent: {},
  businessProblemDerived: false,
  interfaceType: InterfaceType.TABLE_VIEW_RESPONSE_PANEL,
  interfacePayload: {},
};

const writtenTask: SimulationTask = {
  ...reconciliationTask,
  id: 't2',
  taskType: 'STAKEHOLDER_PUSHBACK_RESPONSE',
  objectiveComponent: undefined,
  interfaceType: InterfaceType.TEXT_AREA,
};

function answer(taskId: string, objectiveResponse: unknown) {
  return {
    taskId,
    responseBody: 'Text',
    textResponse: 'Text',
    timeSpentSeconds: 30,
    objectiveResponse,
  };
}

describe('parseAnswers', () => {
  it('accepts a well-formed objective response for its component type', () => {
    const parsed = parseAnswers(
      [answer('t1', { sides: ['BANK', null], adjustedBalance: 9500 })],
      [reconciliationTask],
      registry,
    );
    expect(parsed[0].objectiveResponse).toEqual({ sides: ['BANK', null], adjustedBalance: 9500 });
  });

  it('accepts null for a task with no objective part', () => {
    expect(parseAnswers([answer('t2', null)], [writtenTask], registry)).toHaveLength(1);
  });

  it('rejects an objective response that does not match the task type', () => {
    expect(() =>
      parseAnswers([answer('t1', 42)], [reconciliationTask], registry),
    ).toThrow(BadRequestException);
  });

  it('rejects an answer for a task that is not in the simulation', () => {
    expect(() => parseAnswers([answer('other', null)], [writtenTask], registry)).toThrow(
      BadRequestException,
    );
  });

  it('rejects a payload that is not an array of answers', () => {
    expect(() => parseAnswers({}, [writtenTask], registry)).toThrow(BadRequestException);
  });
});
