import { canonicalCategory } from './category-routing';

describe('canonicalCategory', () => {
  it.each([
    ['FINANCE', 'Finance'],
    ['SALES', 'Sales'],
    ['CUSTOMER_SERVICE', 'Customer Service'],
  ])('renames the saved value %s to %s', (saved, label) => {
    expect(canonicalCategory(saved)).toBe(label);
  });

  it('trims whitespace and otherwise leaves the role exactly as inferred', () => {
    expect(canonicalCategory('  Logistics > Fleet Operations ')).toBe('Logistics > Fleet Operations');
    expect(canonicalCategory('Customer Service > Retention')).toBe('Customer Service > Retention');
  });
});
