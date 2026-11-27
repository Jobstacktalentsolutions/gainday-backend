import { languageMetrics } from './language-metrics';

describe('languageMetrics', () => {
  const plain =
    'A customer paid for an order. The shop got the same payment message two times. What should the shop do first?';
  const technical =
    'The `payments-api` handler received a duplicate webhook for POST /v1/orders; idempotency_key collisions caused double ledger postings under at-least-once delivery.';

  it('scores everyday wording as easier and less technical than jargon-heavy wording', () => {
    const easy = languageMetrics(plain);
    const hard = languageMetrics(technical);
    expect(easy.readingEase).toBeGreaterThan(hard.readingEase);
    expect(easy.technicalPer100Words).toBe(0);
    expect(hard.technicalPer100Words).toBeGreaterThan(5);
  });

  it('names the technical terms it found', () => {
    const { technicalExamples } = languageMetrics(technical);
    expect(technicalExamples).toEqual(
      expect.arrayContaining([
        '`payments-api`',
        '/v1/orders',
        'idempotency_key',
      ]),
    );
  });

  it('does not count ordinary capitalised words as jargon', () => {
    expect(languageMetrics('Reply OK by 5 PM.').technicalPer100Words).toBe(0);
  });
});
