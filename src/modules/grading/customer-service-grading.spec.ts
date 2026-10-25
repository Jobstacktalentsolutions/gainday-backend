import { gradeObjective } from './objective/objective-grader';
import { checklistResults, gateOutcome } from './rubric-results';
import { combineCategoryScores, GATE_JUDGMENT_CAP } from './task-category-scores';
import { LlmCategoryScores } from './schemas/task-grading-result.schema';

const llmScores: LlmCategoryScores = {
  problemSolving: { score: 70, rationale: 'r', evidence: 'e' },
  judgmentExecution: { score: 90, rationale: 'Good policy handling.', evidence: 'e' },
  writtenCommunication: { score: 80, rationale: 'r', evidence: 'e' },
  commercialDomainAwareness: { score: 60, rationale: 'r', evidence: 'e' },
};

describe('multi-select grading', () => {
  const component = {
    options: ['Q1', 'Q2', 'Q3', 'Q4'],
    selectCount: 2,
    correctOptionIndices: [0, 1],
  };

  it('scores a correct pair fully', () => {
    expect(gradeObjective('MULTI_SELECT_UNDER_CONSTRAINT', component, [1, 0])?.score).toBe(100);
  });

  it('cancels a wrong pick against a right one, never below zero', () => {
    expect(gradeObjective('MULTI_SELECT_UNDER_CONSTRAINT', component, [0, 3])).toEqual({
      score: 0,
      correctParts: 0,
      totalParts: 2,
    });
  });
});

describe('keyed classification grading', () => {
  const component = {
    items: ['T-1', 'T-2'],
    buckets: ['Work first', 'Defer'],
    correctMapping: [
      { item: 'T-1', bucket: 'Work first' },
      { item: 'T-2', bucket: 'Defer' },
    ],
  };

  it('gives one part per item that lands in its correct bucket', () => {
    expect(
      gradeObjective('KEYED_CLASSIFICATION', component, { 'T-1': 'Work first', 'T-2': 'Work first' }),
    ).toEqual({ score: 50, correctParts: 1, totalParts: 2 });
  });
});

describe('rubric results', () => {
  const rubric = { checklist: ['Offers the credit', 'Gives a timeframe'], gate: 'Promises a refund' };

  it('names each checklist mark after the task text, not the model', () => {
    expect(
      checklistResults(rubric, {
        checklist: [
          { met: true, evidence: 'store credit of $25' },
          { met: false, evidence: '' },
        ],
      }),
    ).toEqual([
      { item: 'Offers the credit', met: true, evidence: 'store credit of $25' },
      { item: 'Gives a timeframe', met: false, evidence: '' },
    ]);
  });

  it('fails when the marks do not line up with the checklist', () => {
    expect(() => checklistResults(rubric, { checklist: [{ met: true, evidence: '' }] })).toThrow();
  });

  it('reads the gate from the grader only when the task has one', () => {
    expect(gateOutcome(undefined, {})).toBeNull();
    expect(gateOutcome({ checklist: [], gate: null }, {})).toBeNull();
    expect(gateOutcome(rubric, { gateTriggered: true })).toEqual({
      triggered: true,
      description: 'Promises a refund',
    });
    expect(() => gateOutcome(rubric, {})).toThrow();
  });
});

describe('gate cap in combineCategoryScores', () => {
  it('caps judgment at the gate cap when the LLM owns judgment', () => {
    const scores = combineCategoryScores(llmScores, null, {
      triggered: true,
      description: 'Promises a refund',
    });
    expect(scores.judgmentExecution.score).toBe(GATE_JUDGMENT_CAP);
    expect(scores.judgmentExecution.rationale).toContain('Capped at 20');
    expect(scores.problemSolving.score).toBe(70);
  });

  it('leaves judgment alone when no gate is triggered', () => {
    expect(
      combineCategoryScores(llmScores, null, { triggered: false, description: 'x' }).judgmentExecution.score,
    ).toBe(90);
  });

  it('never overrides a judgment settled by the answer key', () => {
    const scores = combineCategoryScores(
      llmScores,
      { score: 100, correctParts: 2, totalParts: 2 },
      { triggered: true, description: 'x' },
    );
    expect(scores.judgmentExecution.score).toBe(100);
  });
});
