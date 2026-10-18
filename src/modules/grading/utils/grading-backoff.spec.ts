import { gradingBackoffStrategy } from './grading-backoff';
import { gradingConfig } from '../../../config/ai.config';

describe('gradingBackoffStrategy', () => {
  const rateLimitError = (extra: Record<string, unknown> = {}) =>
    Object.assign(new Error('Too Many Requests'), { status: 429, ...extra });

  it('backs off exponentially for an ordinary failure', () => {
    const base = gradingConfig.retryBackoffBaseMs;
    expect(gradingBackoffStrategy(1, 'grading', new Error('boom'))).toBe(base);
    expect(gradingBackoffStrategy(3, 'grading', new Error('boom'))).toBe(
      base * 4,
    );
  });

  it('waits longer for a rate-limit failure', () => {
    expect(gradingBackoffStrategy(1, 'grading', rateLimitError())).toBe(
      gradingConfig.rateLimitBackoffBaseMs,
    );
  });

  it('caps the rate-limit backoff', () => {
    expect(gradingBackoffStrategy(10, 'grading', rateLimitError())).toBe(
      gradingConfig.rateLimitBackoffMaxMs,
    );
  });

  it('honours the provider retry-after when given', () => {
    const err = rateLimitError({
      response: { status: 429, headers: { 'retry-after': '120' } },
    });
    expect(gradingBackoffStrategy(1, 'grading', err)).toBe(120_000);
  });
});
