import { isCorrect } from './scoring';

describe('isCorrect', () => {
  it('matches a supported role on its top level, whatever the sub-role', () => {
    expect(isCorrect('Customer Service > Retention', 'Customer Service')).toBe(true);
    expect(isCorrect('Sales', 'Customer Service')).toBe(false);
  });

  it('matches OTHER only for a top level that is not supported', () => {
    expect(isCorrect('Logistics > Fleet Operations', 'OTHER')).toBe(true);
    expect(isCorrect('Finance > Private Equity', 'OTHER')).toBe(false);
  });
});
