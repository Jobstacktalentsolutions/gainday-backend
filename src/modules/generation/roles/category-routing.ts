// Role values saved before the form used category labels. They still resolve to the same role. This is
// a data migration, not a routing rule: it only renames values the product itself used to save.
const LEGACY_ROLE_NAMES: Record<string, string> = {
  FINANCE: 'Finance',
  SALES: 'Sales',
  CUSTOMER_SERVICE: 'Customer Service',
};

/** A role name as the product stores it: trimmed, with a legacy value renamed. Nothing is inferred here. */
export function canonicalCategory(role: string): string {
  const trimmed = role.trim();
  return LEGACY_ROLE_NAMES[trimmed.toUpperCase()] ?? trimmed;
}

/**
 * The category for a job. The employer's chosen role is the top level and is never overridden: a
 * sub-role the employer named is used as is, and otherwise the inferred sub-role is kept only when it
 * sits under the same top level. Without a chosen role, the inferred category is used.
 */
export function resolveCategory(declaredRole: string | undefined, inferred: string): string {
  const inferredCategory = canonicalCategory(inferred);
  if (declaredRole === undefined || declaredRole.trim() === '') return inferredCategory;

  const declared = canonicalCategory(declaredRole);
  if (declared.includes('>')) return declared;

  const inferredTop = inferredCategory.split('>')[0].trim().toLowerCase();
  return inferredTop === declared.toLowerCase() ? inferredCategory : declared;
}
