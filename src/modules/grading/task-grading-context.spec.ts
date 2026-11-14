import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RunnableLambda } from '@langchain/core/runnables';
import type { SimulationTask } from '../../db/schema';
import { RoleRegistry } from '../generation/roles/role-registry';
import { sanitizeTaskForCandidate } from '../simulations/candidate-task.util';
import { AnchorRoleRegistry } from './roles/anchor-role-registry';
import { TaskGradingService } from './task-grading.service';

describe('task grading context', () => {
  it('provides candidate-visible policy and choices without exposing the answer key', async () => {
    const task = {
      id: 'task', category: 'Customer Service', taskType: 'TICKET_TRIAGE',
      title: 'Triage', scenarioDescription: 'Prioritise tickets', questionPrompt: 'Assign each ticket',
      interfaceType: 'CASE_FILE_TEXT_AREA',
      interfacePayload: { caseFile: { tabs: [{ label: 'Policy', content: 'Escalate urgent tickets.' }] } },
      objectiveComponent: { items: ['Ticket A'], buckets: ['Escalate', 'Defer'], correctMapping: [{ item: 'Ticket A', bucket: 'Escalate' }] },
    } as unknown as SimulationTask;
    const candidateTask = sanitizeTaskForCandidate(task, new RoleRegistry());
    const score = { score: 80, rationale: 'Clear.', evidence: 'Escalate.' };
    const invoke = jest.fn().mockResolvedValue({ categoryScores: { writtenCommunication: score }, summary: 'You responded clearly.' });
    const model = { withStructuredOutput: () => RunnableLambda.from(invoke) } as unknown as BaseChatModel;
    const service = new TaskGradingService(model, new AnchorRoleRegistry());

    await service.gradeTask({ category: task.category, taskTitle: task.title, scenarioDescription: task.scenarioDescription,
      questionPrompt: task.questionPrompt, taskContext: candidateTask, anchors: [], candidateResponse: 'Escalate.',
      criteria: ['writtenCommunication'] });
    const input = JSON.parse(String(invoke.mock.calls[0][0][1].content));
    expect(input.task.interfacePayload.caseFile.tabs[0].content).toBe('Escalate urgent tickets.');
    expect(input.task.objectiveComponent).toMatchObject({ items: ['Ticket A'], buckets: ['Escalate', 'Defer'] });
    expect(input.task.objectiveComponent).not.toHaveProperty('correctMapping');
  });
});
