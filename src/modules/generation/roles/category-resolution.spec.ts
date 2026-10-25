import { canonicalCategory, resolveCategory } from './category-routing';

describe('legacy role names', () => {
  it.each([
    ['FINANCE', 'Finance'],
    ['SALES', 'Sales'],
    ['CUSTOMER_SERVICE', 'Customer Service'],
  ])('maps the saved value %s to %s', (saved, label) => {
    expect(canonicalCategory(saved)).toBe(label);
  });
});

describe('resolveCategory', () => {
  it('uses the inferred category when the employer chose no role', () => {
    expect(resolveCategory(undefined, 'Finance > Private Equity')).toBe('Finance > Private Equity');
    expect(resolveCategory('  ', 'Sales > SDR')).toBe('Sales > SDR');
  });

  it('keeps a sub-role the employer named, even if the inference disagrees', () => {
    expect(resolveCategory('Finance > Private Equity', 'Sales > SDR')).toBe('Finance > Private Equity');
  });

  it('infers the sub-role under the chosen top-level role', () => {
    expect(resolveCategory('Finance', 'Finance > Private Equity')).toBe('Finance > Private Equity');
  });

  it('keeps the chosen top-level role when the inference is in a different top level', () => {
    expect(resolveCategory('Finance', 'Sales > SDR')).toBe('Finance');
    expect(resolveCategory('Customer Service', 'Finance > Reconciliation')).toBe('Customer Service');
  });

  it('routes a legacy saved role with an inferred sub-role', () => {
    expect(resolveCategory('FINANCE', 'Finance > Private Equity')).toBe('Finance > Private Equity');
  });
});
