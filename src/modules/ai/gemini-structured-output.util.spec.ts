import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { RunnableLambda } from '@langchain/core/runnables';
import { z } from 'zod';
import { withGeminiSafeStructuredOutput } from './gemini-structured-output.util';

const schema = z.object({ scenario: z.string(), title: z.string() });

function modelReturning(outputs: string[]) {
  const parser = StructuredOutputParser.fromZodSchema(schema);
  let calls = 0;
  const model = {
    model: 'test-model',
    withStructuredOutput: () => RunnableLambda.from(async () => {
      const output = outputs[Math.min(calls, outputs.length - 1)];
      calls += 1;
      return parser.parse(output);
    }),
  } as unknown as BaseChatModel;
  return { model, calls: () => calls };
}

describe('structured output parsing', () => {
  it('preserves a nested JSON code example in an otherwise valid response', async () => {
    const expected = { title: 'Review', scenario: 'Request:\n```json\n{"amount": 1500}\n```' };
    const mock = modelReturning([JSON.stringify(expected)]);
    await expect(withGeminiSafeStructuredOutput(mock.model, schema).invoke('test')).resolves.toEqual(expected);
    expect(mock.calls()).toBe(1);
  });

  it('retries malformed output and validates the next response', async () => {
    const expected = { title: 'Review', scenario: 'A scenario' };
    const mock = modelReturning(['{invalid', JSON.stringify(expected)]);
    await expect(withGeminiSafeStructuredOutput(mock.model, schema).invoke('test')).resolves.toEqual(expected);
    expect(mock.calls()).toBe(2);
  });

  it('rejects JSON that does not match the schema after retries', async () => {
    const mock = modelReturning([JSON.stringify({ title: 42, scenario: 'A scenario' })]);
    await expect(withGeminiSafeStructuredOutput(mock.model, schema).invoke('test')).rejects.toThrow();
    expect(mock.calls()).toBe(3);
  });
});
