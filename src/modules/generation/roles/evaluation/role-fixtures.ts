/**
 * Labelled postings for checking role inference. `expected` is a supported role name (see RoleCategory)
 * or "OTHER" when the posting's domain is not one the product supports. The set is deliberately mixed:
 * customer service and sales wordings that look alike, private equity inside and outside finance, and
 * domains with no module at all. Add a posting here whenever a real one is classified wrongly.
 */
export interface RoleFixture {
  id: string;
  jobDescription: string;
  requiredSkills: string[];
  expected: string;
}

export const ROLE_FIXTURES: RoleFixture[] = [
  {
    id: 'tier2-support-with-retention',
    jobDescription:
      'Handle Tier 2 support tickets via live chat, email and video calls, resolving API integration and account provisioning issues. Diagnose bugs, replicate them in staging and file Jira bug tickets. Also de-escalate frustrated accounts, identify churn risks and maintain the help centre.',
    requiredSkills: ['Technical troubleshooting', 'API basics', 'Customer communication'],
    expected: 'Customer Service',
  },
  {
    id: 'renewals-and-expansion-csm',
    jobDescription:
      'Own a portfolio of 40 enterprise accounts. Carry a renewal and expansion quota, run upsell negotiations, forecast renewal revenue and present commercial plans to account stakeholders.',
    requiredSkills: ['Negotiation', 'Pipeline forecasting', 'Account planning'],
    expected: 'Sales',
  },
  {
    id: 'account-executive-new-logos',
    jobDescription:
      'Prospect and close new business in the mid-market. Run discovery calls, handle objections and negotiate contract terms against a quarterly new-logo target.',
    requiredSkills: ['Prospecting', 'Objection handling', 'Closing'],
    expected: 'Sales',
  },
  {
    id: 'private-equity-fund-accounting',
    jobDescription:
      'Prepare fund accounting and capital account statements for a private equity fund. Reconcile portfolio company valuations, produce quarterly NAV reports and support the annual audit.',
    requiredSkills: ['Fund accounting', 'Reconciliation', 'IFRS 13 valuation'],
    expected: 'Finance',
  },
  {
    id: 'private-equity-portfolio-hr',
    jobDescription:
      'Act as HR partner to the operating teams of several private-equity-backed companies. Lead hiring for leadership roles, design compensation plans and run organisation reviews.',
    requiredSkills: ['Talent acquisition', 'Compensation design', 'Org design'],
    expected: 'OTHER',
  },
  {
    id: 'bank-complaints-handling',
    jobDescription:
      'Investigate and resolve customer complaints about account charges, respond within regulatory timeframes and document each case for the complaints log.',
    requiredSkills: ['Complaints handling', 'Regulatory awareness', 'Written communication'],
    expected: 'Customer Service',
  },
  {
    id: 'reconciliation-accountant',
    jobDescription:
      'Perform month-end bank and intercompany reconciliations, post journal entries and prepare the trial balance for the group close.',
    requiredSkills: ['Bank reconciliation', 'Journal entries', 'Excel'],
    expected: 'Finance',
  },
  {
    id: 'fleet-operations',
    jobDescription:
      'Plan daily vehicle dispatch for a fleet of 200 delivery trucks, optimise routes and manage driver rota and maintenance schedules.',
    requiredSkills: ['Route planning', 'Dispatch', 'Fleet maintenance'],
    expected: 'OTHER',
  },
  {
    id: 'clinical-operations',
    jobDescription:
      'Coordinate patient admissions and discharge planning on a medical ward, manage bed capacity and liaise with clinicians and social care teams.',
    requiredSkills: ['Clinical coordination', 'Capacity planning', 'Patient safety'],
    expected: 'OTHER',
  },
  {
    id: 'property-tenant-relations',
    jobDescription:
      'Manage tenant relations for a portfolio of commercial buildings, handle lease renewals, service requests and building access.',
    requiredSkills: ['Property management', 'Lease administration', 'Tenant communication'],
    expected: 'OTHER',
  },
];
