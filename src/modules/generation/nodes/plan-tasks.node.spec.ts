import { planTasksNode, buildPlanTasksPrompt } from './plan-tasks.node';
import { GenerationContext } from '../graph/generation-context';
import { GenerationState } from '../state/generation-state';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

describe('planTasksNode', () => {
  describe('buildPlanTasksPrompt', () => {
    it('produces a strict uniqueness prompt when allowedTypes >= targetCount', () => {
      const prompt = buildPlanTasksPrompt(4, 6);
      expect(prompt).toContain('UNIQUE taskType from the allowed list (no duplicates)');
      expect(prompt).not.toContain('Only');
    });

    it('produces a constrained duplication prompt when allowedTypes < targetCount', () => {
      const prompt = buildPlanTasksPrompt(4, 2);
      expect(prompt).toContain('Only 2 task types exist for this role, but exactly 4 tasks are required');
      expect(prompt).toContain('use every available task type at least once');
      expect(prompt).toContain('duplicate the task type(s) most crucial');
    });
  });

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

  it('deduplicates and fills from unused role types if model ever returns duplicate taskTypes', async () => {
    const duplicateCandidates = [
      { candidateId: 'cand-1', taskType: 'TYPE_A', briefDescription: 'A' },
      { candidateId: 'cand-2', taskType: 'TYPE_A', briefDescription: 'A duplicate' },
      { candidateId: 'cand-3', taskType: 'TYPE_B', briefDescription: 'B' },
      { candidateId: 'cand-4', taskType: 'TYPE_B', briefDescription: 'B duplicate' },
    ];

    const mockInvoke = jest.fn().mockResolvedValue({
      candidates: duplicateCandidates,
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
      jobId: 'job-456',
      category: 'Sales',
      intent: 'Outreach and qualification',
      problem: null,
      roleModule: {
        allowedTaskPatternTypes: [
          { key: 'TYPE_A', description: 'Type A' },
          { key: 'TYPE_B', description: 'Type B' },
          { key: 'TYPE_C', description: 'Type C' },
          { key: 'TYPE_D', description: 'Type D' },
        ],
      },
    } as unknown as GenerationState;

    const node = planTasksNode(mockCtx);
    const result = await node(mockState);

    expect(result.candidatePool).toHaveLength(4);
    const types = result.candidatePool?.map((c) => c.taskType);
    expect(new Set(types).size).toBe(4);
    expect(types).toContain('TYPE_A');
    expect(types).toContain('TYPE_B');
    expect(types).toContain('TYPE_C');
    expect(types).toContain('TYPE_D');
  });

  it('handles constrained case when allowed types < targetCount by using all types and allowing crucial duplicates', async () => {
    // Only 2 allowed types available, targetCount = 4
    const returnedCandidates = [
      { candidateId: 'cand-1', taskType: 'TYPE_A', briefDescription: 'A initial' },
      { candidateId: 'cand-2', taskType: 'TYPE_A', briefDescription: 'A deep dive' },
      { candidateId: 'cand-3', taskType: 'TYPE_B', briefDescription: 'B initial' },
      { candidateId: 'cand-4', taskType: 'TYPE_A', briefDescription: 'A advanced' },
    ];

    const mockInvoke = jest.fn().mockResolvedValue({
      candidates: returnedCandidates,
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
      jobId: 'job-constrained',
      category: 'Specialized',
      intent: 'Core specialized assessment',
      problem: null,
      roleModule: {
        allowedTaskPatternTypes: [
          { key: 'TYPE_A', description: 'Type A' },
          { key: 'TYPE_B', description: 'Type B' },
        ],
      },
    } as unknown as GenerationState;

    const node = planTasksNode(mockCtx);
    const result = await node(mockState);

    expect(result.candidatePool).toHaveLength(4);
    const types = result.candidatePool?.map((c) => c.taskType);
    // Both types must be present
    expect(types).toContain('TYPE_A');
    expect(types).toContain('TYPE_B');
    // Candidate IDs are cleanly sequenced
    expect(result.candidatePool?.map((c) => c.candidateId)).toEqual([
      'cand-1',
      'cand-2',
      'cand-3',
      'cand-4',
    ]);
  });

  it('in constrained case, ensures any omitted allowed types are injected to cover all types', async () => {
    // LLM returned 4 of TYPE_A and completely omitted TYPE_B
    const returnedCandidates = [
      { candidateId: 'cand-1', taskType: 'TYPE_A', briefDescription: 'A 1' },
      { candidateId: 'cand-2', taskType: 'TYPE_A', briefDescription: 'A 2' },
      { candidateId: 'cand-3', taskType: 'TYPE_A', briefDescription: 'A 3' },
      { candidateId: 'cand-4', taskType: 'TYPE_A', briefDescription: 'A 4' },
    ];

    const mockInvoke = jest.fn().mockResolvedValue({
      candidates: returnedCandidates,
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
      jobId: 'job-constrained-missing',
      category: 'Specialized',
      intent: 'Core specialized assessment',
      problem: null,
      roleModule: {
        allowedTaskPatternTypes: [
          { key: 'TYPE_A', description: 'Type A' },
          { key: 'TYPE_B', description: 'Type B' },
        ],
      },
    } as unknown as GenerationState;

    const node = planTasksNode(mockCtx);
    const result = await node(mockState);

    expect(result.candidatePool).toHaveLength(4);
    const types = result.candidatePool?.map((c) => c.taskType);
    expect(types).toContain('TYPE_A');
    expect(types).toContain('TYPE_B'); // Injected!
    expect(result.candidatePool?.map((c) => c.candidateId)).toEqual([
      'cand-1',
      'cand-2',
      'cand-3',
      'cand-4',
    ]);
  });
});
