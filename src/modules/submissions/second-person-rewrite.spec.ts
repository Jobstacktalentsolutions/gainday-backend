import { rewriteSecondPersonForEmployer } from './second-person-rewrite';

describe('rewriteSecondPersonForEmployer', () => {
  it('rewrites a subject "you" after a leading clause', () => {
    expect(rewriteSecondPersonForEmployer('Once you have finished the report, send it.', 'SHE_HER')).toBe(
      'Once she has finished the report, send it.',
    );
  });

  it('keeps the subject for contractions that take a subject', () => {
    expect(rewriteSecondPersonForEmployer("You'll need to check the totals.", 'SHE_HER')).toBe(
      "She'll need to check the totals.",
    );
  });

  it('rewrites an object "you" to the object pronoun', () => {
    expect(rewriteSecondPersonForEmployer('The reply thanks you for the call.', 'SHE_HER')).toBe(
      'The reply thanks her for the call.',
    );
  });

  it('uses "they" when pronouns are unknown', () => {
    expect(rewriteSecondPersonForEmployer('You are careful.', null)).toBe('They are careful.');
  });
});
