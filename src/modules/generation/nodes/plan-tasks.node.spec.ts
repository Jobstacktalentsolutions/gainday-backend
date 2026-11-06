import { planTasksNode } from './plan-tasks.node';
import { GenerationContext } from '../graph/generation-context';
import { GenerationState } from '../state/generation-state';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

describe('planTasksNode', () => {
  it('plans 4 unique candidates and populates candidatePool and selectedCandidates', async () => {
    const mockCandidates = [
      {
        candidateId: 'cand-1',
        taskType: 'TYPE_A',
        briefDescription: 'Description A',
      },
      {
        candidateId: 'cand-2',
        taskType: 'TYPE_B',
        briefDescription: 'Description B',
      },
      {
        candidateId: 'cand-3',
        taskType: 'TYPE_C',
        briefDescription: 'Description C',
      },
      {
        candidateId: 'cand-4',
        taskType: 'TYPE_D',
        briefDescription: 'Description D',
      },
    ];

    const mockInvoke = jest.fn().mockResolvedValue({
      candidates: mockCandidates,
    });
    const mockModel = {
      withStructuredOutput: jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          invoke: mockInvoke,
        }),
        invoke: mockInvoke,
      }),
    } as unknown as BaseChatModel;

    const mockCtx = {
      generationModel: mockModel,
      config: { selectedTaskCount: 4 },
    } as unknown as GenerationContext;

    const mockState = {
      jobId: 'job-123',
      category: 'Sales',
      intent: 'Outreach and qualification',
      problem: null,
      roleModule: {
        allowedTaskPatternTypes: [
          { key: 'TYPE_A', description: 'Type A description' },
          { key: 'TYPE_B', description: 'Type B description' },
          { key: 'TYPE_C', description: 'Type C description' },
          { key: 'TYPE_D', description: 'Type D description' },
          { key: 'TYPE_E', description: 'Type E description' },
        ],
      },
    } as unknown as GenerationState;

    const node = planTasksNode(mockCtx);
    const result = await node(mockState);

    expect(result.candidatePool).toHaveLength(4);
    expect(result.selectedCandidates).toHaveLength(4);
    expect(result.candidatePool?.[0]).toEqual({
      candidateId: 'cand-1',
      taskType: 'TYPE_A',
      briefDescription: 'Description A',
      selected: true,
    });
    expect(result.selectedCandidates).toEqual(result.candidatePool);

    // Verify task types are all unique
    const types = result.candidatePool?.map((c) => c.taskType);
    expect(new Set(types).size).toBe(4);
  });
});
