import { isNotAttempted } from './not-attempted';

describe('isNotAttempted', () => {
  it('counts a per-item reason as an attempt', () => {
    expect(isNotAttempted({ textResponse: '', objectiveResponse: null, itemReasons: { A: 'Requires review' } })).toBe(false);
  });

  it('treats empty reasons as unanswered', () => {
    expect(isNotAttempted({ textResponse: '', objectiveResponse: null, itemReasons: { A: ' ' } })).toBe(true);
  });
});
