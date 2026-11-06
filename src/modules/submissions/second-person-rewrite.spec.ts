import { rewriteSecondPersonForEmployer } from './second-person-rewrite';

describe('rewriteSecondPersonForEmployer', () => {
  it('rewrites a subject "you" after a leading clause', () => {
    expect(
      rewriteSecondPersonForEmployer('Once you have finished the report, send it.'),
    ).toBe('Once this candidate has finished the report, send it.');
  });

  it('keeps the subject for contractions that take a subject', () => {
    expect(
      rewriteSecondPersonForEmployer("You'll need to check the totals."),
    ).toBe('This candidate will need to check the totals.');
  });

  it('rewrites an object "you" to the general pointer', () => {
    expect(
      rewriteSecondPersonForEmployer('The reply thanks you for the call.'),
    ).toBe('The reply thanks this candidate for the call.');
  });

  it('rewrites "You are" to "This candidate is"', () => {
    expect(rewriteSecondPersonForEmployer('You are careful.')).toBe(
      'This candidate is careful.',
    );
  });

  it('rewrites possessive "your" to "this candidate\'s"', () => {
    expect(
      rewriteSecondPersonForEmployer('Your analysis was thorough.'),
    ).toBe("This candidate's analysis was thorough.");
  });
});
