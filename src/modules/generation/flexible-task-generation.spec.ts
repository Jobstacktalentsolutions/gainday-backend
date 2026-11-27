import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { generateTaskContent } from './task-content-generator';
import {
  GenericRoleModule,
  GenericTaskType,
} from './roles/generic/generic.role-module';
import { InterfaceType } from './roles/interface-type';
import { withGeminiSafeStructuredOutput } from '../ai/gemini-structured-output.util';

jest.mock('../ai/gemini-structured-output.util', () => ({
  withGeminiSafeStructuredOutput: jest.fn(),
}));

describe('flexible task generation', () => {
  const draft = {
    taskType: GenericTaskType.DRAFTED_COMMUNICATION,
    title: 'Review a pull request',
    expectedDurationMinutes: 7,
    scenarioDescription: 'A teammate requests a review.',
    questionPrompt: 'Write a review comment using headings.',
    businessProblemDerived: false,
    objectiveComponent: null,
    openEndedComponent: {
      recipient: 'teammate',
      goal: 'Review the pull request',
    },
    presentationNeeds: 'A formatted written answer and source code to inspect.',
    referenceMaterial: 'The diff adds an unvalidated input.',
  };

  it('selects the presentation after seeing the task and preserves its answer requirements', async () => {
    const pattern = GenericRoleModule.allowedTaskPatternTypes.find(
      (item) => item.key === String(GenericTaskType.DRAFTED_COMMUNICATION),
    )!;
    const payloads: Record<string, unknown> = Object.fromEntries(
      pattern.allowedInterfaceTypes!.map((type) => [type, null]),
    );
    payloads[InterfaceType.RICH_TEXT_COMPOSER] = {
      interfaceType: InterfaceType.RICH_TEXT_COMPOSER,
      placeholder: null,
      wordLimit: { min: 20, max: 150 },
    };
    const outputs: unknown[] = [
      draft,
      {
        interfaceType: InterfaceType.RICH_TEXT_COMPOSER,
        scenarioDescription:
          'A teammate requests a review. The diff adds an unvalidated input.',
        questionPrompt: draft.questionPrompt,
        payloads,
      },
    ];
    const calls: unknown[] = [];
    jest.mocked(withGeminiSafeStructuredOutput).mockImplementation(
      (_model, schema) =>
        ({
          invoke: (input: unknown) => {
            calls.push(input);
            return Promise.resolve(schema.parse(outputs.shift()));
          },
        }) as never,
    );

    const result = await generateTaskContent({
      model: {} as BaseChatModel,
      roleModule: GenericRoleModule,
      category: 'Engineering',
      intent: 'Review code',
      problem: null,
      taskType: GenericTaskType.DRAFTED_COMMUNICATION,
      briefDescription: 'Write a PR review.',
    });
    expect(calls).toHaveLength(2);
    expect(JSON.stringify(calls[1])).toContain(draft.presentationNeeds);
    expect(JSON.stringify(calls[1])).toContain(draft.referenceMaterial);
    expect(result.interfaceType).toBe(InterfaceType.RICH_TEXT_COMPOSER);
    expect(result.interfacePayload).toEqual(
      payloads[InterfaceType.RICH_TEXT_COMPOSER],
    );
    expect(result.scenarioDescription).toContain('unvalidated input');
  });

  it('rejects a selection without the selected interface payload', async () => {
    const pattern = GenericRoleModule.allowedTaskPatternTypes.find(
      (item) => item.key === String(GenericTaskType.DRAFTED_COMMUNICATION),
    )!;
    const outputs: unknown[] = [
      draft,
      {
        interfaceType: InterfaceType.RICH_TEXT_COMPOSER,
        scenarioDescription: draft.scenarioDescription,
        questionPrompt: draft.questionPrompt,
        payloads: Object.fromEntries(
          pattern.allowedInterfaceTypes!.map((type) => [type, null]),
        ),
      },
    ];
    jest.mocked(withGeminiSafeStructuredOutput).mockImplementation(
      (_model, schema) =>
        ({
          invoke: () => Promise.resolve(schema.parse(outputs.shift())),
        }) as never,
    );
    await expect(
      generateTaskContent({
        model: {} as BaseChatModel,
        roleModule: GenericRoleModule,
        category: 'Engineering',
        intent: 'Review code',
        problem: null,
        taskType: GenericTaskType.DRAFTED_COMMUNICATION,
        briefDescription: 'Write a PR review.',
      }),
    ).rejects.toThrow('selected interface has no matching payload');
  });

  it('requires the model to size the word limit of a written answer', async () => {
    const pattern = GenericRoleModule.allowedTaskPatternTypes.find(
      (item) => item.key === String(GenericTaskType.DRAFTED_COMMUNICATION),
    )!;
    const payloads: Record<string, unknown> = Object.fromEntries(
      pattern.allowedInterfaceTypes!.map((type) => [type, null]),
    );
    payloads[InterfaceType.RICH_TEXT_COMPOSER] = {
      interfaceType: InterfaceType.RICH_TEXT_COMPOSER,
      placeholder: null,
      wordLimit: null,
    };
    const outputs: unknown[] = [
      draft,
      {
        interfaceType: InterfaceType.RICH_TEXT_COMPOSER,
        scenarioDescription: draft.scenarioDescription,
        questionPrompt: draft.questionPrompt,
        payloads,
      },
    ];
    jest.mocked(withGeminiSafeStructuredOutput).mockImplementation(
      (_model, schema) =>
        ({
          invoke: () => Promise.resolve(schema.parse(outputs.shift())),
        }) as never,
    );
    await expect(
      generateTaskContent({
        model: {} as BaseChatModel,
        roleModule: GenericRoleModule,
        category: 'Engineering',
        intent: 'Review code',
        problem: null,
        taskType: GenericTaskType.DRAFTED_COMMUNICATION,
        briefDescription: 'Write a PR review.',
      }),
    ).rejects.toThrow();
  });

  it('materializes a selected chart from one dataset', async () => {
    const pattern = GenericRoleModule.allowedTaskPatternTypes.find(
      (item) => item.key === String(GenericTaskType.DATA_INTERPRETATION),
    )!;
    const payloads: Record<string, unknown> = Object.fromEntries(
      pattern.allowedInterfaceTypes!.map((type) => [type, null]),
    );
    payloads[InterfaceType.TABLE_VIEW_WITH_CHART] = {
      type: 'bar',
      categoryLabel: 'Week',
      categories: ['One', 'Two'],
      series: [
        { name: 'Errors', values: [2, 5], kind: 'bar', axis: 'primary' },
      ],
      totals: [],
      placeholder: null,
      wordLimit: { min: 20, max: 150 },
    };
    const outputs: unknown[] = [
      {
        ...draft,
        taskType: GenericTaskType.DATA_INTERPRETATION,
        openEndedComponent: { dataToInterpret: 'Compare error counts.' },
        referenceMaterial: 'Week one had 2 errors; week two had 5.',
      },
      {
        interfaceType: InterfaceType.TABLE_VIEW_WITH_CHART,
        scenarioDescription: 'Your team tracks how many errors the service logs each week, and the chart shows the last four weeks.',
        questionPrompt: 'Explain the change.',
        payloads,
      },
    ];
    jest.mocked(withGeminiSafeStructuredOutput).mockImplementation(
      (_model, schema) =>
        ({
          invoke: () => Promise.resolve(schema.parse(outputs.shift())),
        }) as never,
    );
    const result = await generateTaskContent({
      model: {} as BaseChatModel,
      roleModule: GenericRoleModule,
      category: 'Engineering',
      intent: 'Interpret data',
      problem: null,
      taskType: GenericTaskType.DATA_INTERPRETATION,
      briefDescription: 'Compare errors.',
    });
    expect(result.interfaceType).toBe(InterfaceType.TABLE_VIEW_WITH_CHART);
    expect(result.interfacePayload).toMatchObject({
      table: {
        rows: [
          ['One', '2'],
          ['Two', '5'],
        ],
      },
      chart: { categories: ['One', 'Two'], series: [{ values: [2, 5] }] },
    });
  });
});
