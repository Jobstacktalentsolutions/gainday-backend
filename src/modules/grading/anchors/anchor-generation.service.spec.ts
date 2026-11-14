import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RunnableLambda } from '@langchain/core/runnables';
import type { QuestionBankEntry } from '../../../db/schema/question-bank.schema';
import { AnchorGenerationService } from './anchor-generation.service';
import { AnchorRoleRegistry } from '../roles/anchor-role-registry';

const points = [20, 40, 60, 80, 100];
const criteria = { problemSolving: '', judgmentExecution: '', writtenCommunication: '', commercialDomainAwareness: '' };
const anchors = points.map((score) => ({ score, commitments: [], responseText: `answer ${score}`, criteria }));

describe('AnchorGenerationService retry flow', () => {
  it('passes reviewer feedback to the next attempt', async () => {
    const generate = jest.fn().mockResolvedValue({ anchors });
    const critique = jest.fn()
      .mockResolvedValueOnce({ sound: false, reasons: ['Strong answer invents a policy'], anchorFeedback: [{ anchorIndex: 4, sound: false, issue: 'Unsupported approval' }] })
      .mockResolvedValueOnce({ sound: true, reasons: [], anchorFeedback: [] });
    const generator = { withStructuredOutput: () => RunnableLambda.from(generate) } as unknown as BaseChatModel;
    const critic = { withStructuredOutput: () => RunnableLambda.from(critique) } as unknown as BaseChatModel;
    const set = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    const config = new ConfigService({ grading: { maxAnchorAttempts: 3 }, generation: { anchorScorePoints: points } });
    const service = new AnchorGenerationService({ update: () => ({ set }) } as never, generator, critic, new AnchorRoleRegistry(), config);
    const row = { id: 'question-id', category: 'Finance', intent: 'accounting', anchors: null, taskContent: {} } as unknown as QuestionBankEntry;

    await expect(service.ensureAnchors(row)).resolves.toEqual(anchors);
    const input = JSON.parse(String(generate.mock.calls[1][0][1].content));
    expect(input.previousAttemptIssues).toEqual(expect.arrayContaining(['Strong answer invents a policy', 'Anchor 4: Unsupported approval']));
  });

  it('passes a failed commitment check to the next generation and persists a validated set', async () => {
    const invalid = anchors.map((anchor) => anchor.score === 100
      ? { ...anchor, commitments: [{ kind: 'STORE_CREDIT', amount: 50 }] }
      : anchor);
    const generate = jest.fn().mockResolvedValueOnce({ anchors: invalid }).mockResolvedValueOnce({ anchors });
    const critique = jest.fn().mockResolvedValue({ sound: true, reasons: [], anchorFeedback: [] });
    const generator = { withStructuredOutput: () => RunnableLambda.from(generate) } as unknown as BaseChatModel;
    const critic = { withStructuredOutput: () => RunnableLambda.from(critique) } as unknown as BaseChatModel;
    const where = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockReturnValue({ where });
    const db = { update: jest.fn().mockReturnValue({ set }) };
    const config = new ConfigService({ grading: { maxAnchorAttempts: 3 }, generation: { anchorScorePoints: points } });
    const service = new AnchorGenerationService(db as never, generator, critic, new AnchorRoleRegistry(), config);
    const row = {
      id: 'question-id', category: 'Customer Service', intent: 'support', anchors: null,
      taskContent: { rubric: { checklist: [], gate: null, authorisedCommitments: [{ kind: 'STORE_CREDIT', amount: 25 }] } },
    } as unknown as QuestionBankEntry;

    await expect(service.ensureAnchors(row)).resolves.toEqual(anchors);
    expect(generate).toHaveBeenCalledTimes(2);
    const input = JSON.parse(String(generate.mock.calls[1][0][1].content));
    expect(input.previousAttemptIssues).toEqual([expect.stringContaining('store credit of 50')]);
    expect(critique).toHaveBeenCalledTimes(1);
    const reviewInput = JSON.parse(String(critique.mock.calls[0][0][1].content));
    expect(reviewInput).toMatchObject({ category: row.category, intent: row.intent });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ anchors, anchorsNeedReview: false }));
  });

  it('does not persist an anchor set that repeatedly fails the commitment check', async () => {
    const invalid = anchors.map((anchor) => anchor.score === 100
      ? { ...anchor, commitments: [{ kind: 'CASH_REFUND', amount: 100 }] }
      : anchor);
    const generate = jest.fn().mockResolvedValue({ anchors: invalid });
    const generator = { withStructuredOutput: () => RunnableLambda.from(generate) } as unknown as BaseChatModel;
    const critic = { withStructuredOutput: () => RunnableLambda.from(jest.fn()) } as unknown as BaseChatModel;
    const db = { update: jest.fn() };
    const config = new ConfigService({ grading: { maxAnchorAttempts: 3 }, generation: { anchorScorePoints: points } });
    const service = new AnchorGenerationService(db as never, generator, critic, new AnchorRoleRegistry(), config);
    const row = {
      id: 'question-id', category: 'Customer Service', intent: 'support', anchors: null,
      taskContent: { rubric: { checklist: [], gate: null, authorisedCommitments: [] } },
    } as unknown as QuestionBankEntry;

    await expect(service.ensureAnchors(row)).rejects.toThrow('no anchor set passed');
    expect(generate).toHaveBeenCalledTimes(3);
    expect(db.update).not.toHaveBeenCalled();
  });
});
