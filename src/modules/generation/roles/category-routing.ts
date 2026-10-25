/** The category retention, renewal and account-management roles belong to. Sales owns these: the sales
 *  doc defines the CSM sub-role as renewal and retention conversations, and the customer service module
 *  covers service issues only. */
export const RETENTION_CATEGORY = 'Sales > CSM';

// Sub-role words that mean retention, whatever top-level category the extraction step chose.
const RETENTION_SUBROLE = /\b(retention|renewals?|customer success|account managers?|account management|csm)\b/i;

/**
 * Maps the category the extraction step returned to the one the engine routes and grades by. The
 * category string is stored with the task, and grading resolves anchors from it, so this runs once,
 * right after extraction: every later stage then agrees on the same role.
 */
export function canonicalCategory(extracted: string): string {
  const subRole = extracted.includes('>') ? extracted.split('>').slice(1).join('>') : extracted;
  return RETENTION_SUBROLE.test(subRole) ? RETENTION_CATEGORY : extracted.trim();
}
