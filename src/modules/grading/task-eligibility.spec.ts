import { isGradedByAnswer } from './task-eligibility';

describe('isGradedByAnswer', () => {
  it('excludes a staged chat, which is graded from its transcript', () => {
    expect(isGradedByAnswer({ interfaceType: 'STAGED_CHAT' })).toBe(false);
  });

  it('keeps every other task on the answer path', () => {
    expect(isGradedByAnswer({ interfaceType: 'TEXT_AREA' })).toBe(true);
    expect(isGradedByAnswer({ interfaceType: 'CASE_FILE_TEXT_AREA' })).toBe(true);
  });
});
