import { combineCategoryScores, criteriaForLlm } from './task-category-scores';
import { LlmCategoryScores } from './schemas/task-grading-result.schema';

const llmScores: LlmCategoryScores = {
  problemSolving: { score: 10, rationale: 'r', evidence: 'e' },
  judgmentExecution: { score: 20, rationale: 'r', evidence: 'e' },
  writtenCommunication: { score: 70, rationale: 'r', evidence: 'e' },
  commercialDomainAwareness: { score: 80, rationale: 'r', evidence: 'e' },
};

describe('criteriaForLlm', () => {
  it('leaves all four criteria to the LLM when there is no answer-key result', () => {
    expect(criteriaForLlm(false)).toEqual([
      'problemSolving',
      'judgmentExecution',
      'writtenCommunication',
      'commercialDomainAwareness',
    ]);
  });

  it('leaves only the written and commercial criteria to the LLM when the key settles the rest', () => {
    expect(criteriaForLlm(true)).toEqual(['writtenCommunication', 'commercialDomainAwareness']);
  });
});

describe('combineCategoryScores', () => {
  it('uses the LLM scores unchanged when there is no objective result', () => {
    const scores = combineCategoryScores(llmScores, null);
    expect(scores.problemSolving.score).toBe(10);
    expect(scores.judgmentExecution.score).toBe(20);
  });

  it('takes problem-solving and judgment from the answer key, and the rest from the LLM', () => {
    const scores = combineCategoryScores(
      {
        writtenCommunication: llmScores.writtenCommunication,
        commercialDomainAwareness: llmScores.commercialDomainAwareness,
      },
      { score: 60, correctParts: 3, totalParts: 5 },
    );
    expect(scores.problemSolving.score).toBe(60);
    expect(scores.judgmentExecution.score).toBe(60);
    expect(scores.writtenCommunication.score).toBe(70);
    expect(scores.commercialDomainAwareness.score).toBe(80);
    expect(scores.problemSolving.evidence).toBe('3 of 5 parts match the key.');
  });

  it('fails loudly when the LLM omits a criterion it was asked to score', () => {
    expect(() =>
      combineCategoryScores({ writtenCommunication: llmScores.writtenCommunication }, null),
    ).toThrow('The grader returned no score for problemSolving');
  });
});
