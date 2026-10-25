import { canonicalCategory, RETENTION_CATEGORY } from './category-routing';

describe('canonicalCategory', () => {
  it.each([
    ['Customer Service > Retention', RETENTION_CATEGORY],
    ['Customer Service > Renewals', RETENTION_CATEGORY],
    ['Customer Support > Customer Success', RETENTION_CATEGORY],
    ['Sales > Account Management', RETENTION_CATEGORY],
    ['Retention', RETENTION_CATEGORY],
  ])('routes "%s" to retention ownership', (extracted, expected) => {
    expect(canonicalCategory(extracted)).toBe(expected);
  });

  it.each([
    ['Customer Service > Complaints'],
    ['Customer Service'],
    ['Sales > SDR'],
    ['Finance > Reconciliation'],
  ])('leaves "%s" as extracted', (extracted) => {
    expect(canonicalCategory(extracted)).toBe(extracted);
  });

  it('does not treat a word that merely contains a retention term as retention', () => {
    expect(canonicalCategory('Customer Service > Csmx Escalations')).toBe('Customer Service > Csmx Escalations');
  });
});
