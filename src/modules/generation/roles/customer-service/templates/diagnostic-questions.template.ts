import { z } from 'zod';
import { defineTaskSpec, requireUnique, requireValid } from '../../task-spec';
import { caseFilePayload, factTable } from '../case-file';

const dataSchema = z.object({
  customerName: z.string().describe('A fictional customer name.'),
  product: z
    .string()
    .describe('A common product category: login, billing, delivery or app crash.'),
  symptomReport: z
    .string()
    .describe('The vague report, e.g. "it is not working". State no figures.'),
  causes: z
    .array(z.object({ label: z.string().describe('A plausible root cause, unique within the task.') }))
    .length(3)
    .describe('Three plausible root causes of the report.'),
  questions: z
    .array(
      z.object({
        text: z.string().describe('A question to ask the customer. Unique within the task.'),
        answers: z
          .array(z.string())
          .length(3)
          .describe('The answer this question would get under each cause, in the order of causes.'),
      }),
    )
    .min(5)
    .max(6),
});

// Diagnostic questioning (customer service doc Section 2.4). A question is useful when its answer
// differs across causes; the key is the one pair of questions that separates all three causes. Code
// derives it, and the task is rejected unless exactly one such pair exists, so the key is unique.
export const diagnosticQuestionsSpec = defineTaskSpec(dataSchema, (data) => {
  requireUnique(
    data.causes.map((cause) => cause.label),
    'cause labels',
  );
  requireUnique(
    data.questions.map((question) => question.text),
    'question texts',
  );

  const useful = data.questions.map(
    (question) => new Set(question.answers).size > 1,
  );
  const separatingPairs: [number, number][] = [];
  for (let first = 0; first < data.questions.length; first++) {
    for (let second = first + 1; second < data.questions.length; second++) {
      if (!useful[first] || !useful[second]) continue;
      const pairs = new Set(
        data.causes.map((_cause, index) =>
          JSON.stringify([
            data.questions[first].answers[index],
            data.questions[second].answers[index],
          ]),
        ),
      );
      if (pairs.size === data.causes.length) separatingPairs.push([first, second]);
    }
  }
  requireValid(
    separatingPairs.length === 1,
    `exactly one pair of questions must separate the causes (found ${separatingPairs.length})`,
  );
  const [first, second] = separatingPairs[0];

  return {
    interfacePayload: caseFilePayload(
      [
        {
          label: 'Customer record',
          content: factTable([
            ['Customer', data.customerName],
            ['Product', data.product],
          ]),
        },
        {
          label: 'Ticket',
          content: `**${data.customerName}:**\n\n${data.symptomReport}`,
        },
      ],
      { min: 30, max: 110 },
    ),
    objectiveComponent: {
      options: data.questions.map((question) => question.text),
      selectCount: 2,
      correctOptionIndices: [first, second],
    },
    rubric: {
      checklist: [
        'Asks for the information behind both selected questions',
        'Uses plain language a non-technical customer can follow',
      ],
      gate: null,
      authorisedCommitments: [],
    },
  };
});
