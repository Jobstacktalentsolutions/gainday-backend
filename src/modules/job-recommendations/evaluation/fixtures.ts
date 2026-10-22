// Labelled sample data for judging the matcher. `family` is the ground truth: a candidate is a
// correct match for a job when they share a family. Titles deliberately use synonyms and loose
// phrasing, since that is what the matcher has to cope with in real data.

export const FAMILIES = [
  'software',
  'data',
  'product',
  'nursing',
  'accounting',
  'marketing',
] as const;
export type Family = (typeof FAMILIES)[number];

export interface EvalJob {
  id: string;
  family: Family;
  title: string;
  role: string | null;
  requiredSkills: string[];
  businessProblem: string | null;
  description: string;
}

export interface EvalCandidate {
  id: string;
  family: Family;
  title: string;
  brief: string | null;
}

export const EVAL_JOBS: EvalJob[] = [
  {
    id: 'job-sw-1',
    family: 'software',
    title: 'Senior Frontend Engineer',
    role: 'Engineering',
    requiredSkills: ['React', 'TypeScript', 'CSS'],
    businessProblem: 'Our customer dashboard is slow and hard to maintain.',
    description: 'Build and ship user-facing features in a React and TypeScript codebase.',
  },
  {
    id: 'job-sw-2',
    family: 'software',
    title: 'Backend Software Engineer',
    role: 'Engineering',
    requiredSkills: ['Node.js', 'PostgreSQL', 'REST APIs'],
    businessProblem: 'Payment processing needs to scale without downtime.',
    description: 'Design and operate services and APIs backed by PostgreSQL.',
  },
  {
    id: 'job-data-1',
    family: 'data',
    title: 'Data Analyst',
    role: 'Analytics',
    requiredSkills: ['SQL', 'Tableau', 'Statistics'],
    businessProblem: 'Leadership lacks a reliable view of weekly retention.',
    description: 'Turn raw product data into dashboards and insights for decision makers.',
  },
  {
    id: 'job-data-2',
    family: 'data',
    title: 'Machine Learning Engineer',
    role: 'Analytics',
    requiredSkills: ['Python', 'scikit-learn', 'Model deployment'],
    businessProblem: 'Fraud detection misses too many suspicious transactions.',
    description: 'Train, evaluate and deploy predictive models into production systems.',
  },
  {
    id: 'job-product-1',
    family: 'product',
    title: 'Product Manager',
    role: 'Product',
    requiredSkills: ['Roadmapping', 'User research', 'Stakeholder management'],
    businessProblem: 'The onboarding flow loses most new users in week one.',
    description: 'Own the product roadmap and work with engineering and design to ship it.',
  },
  {
    id: 'job-product-2',
    family: 'product',
    title: 'Associate Product Owner',
    role: 'Product',
    requiredSkills: ['Agile', 'Backlog management', 'Jira'],
    businessProblem: null,
    description: 'Manage the team backlog and clarify requirements for the delivery squad.',
  },
  {
    id: 'job-nursing-1',
    family: 'nursing',
    title: 'Staff Nurse, Medical Ward',
    role: 'Clinical',
    requiredSkills: ['Patient care', 'Medication administration', 'NMC registration'],
    businessProblem: null,
    description: 'Provide hands-on nursing care to inpatients on a busy medical ward.',
  },
  {
    id: 'job-nursing-2',
    family: 'nursing',
    title: 'Community Nurse',
    role: 'Clinical',
    requiredSkills: ['Wound care', 'Home visits', 'Clinical assessment'],
    businessProblem: null,
    description: 'Deliver nursing care to patients in their homes across the district.',
  },
  {
    id: 'job-accounting-1',
    family: 'accounting',
    title: 'Management Accountant',
    role: 'Finance',
    requiredSkills: ['Month-end close', 'Forecasting', 'ACA or ACCA'],
    businessProblem: 'Monthly reporting takes too long to close.',
    description: 'Prepare management accounts, variance analysis and forecasts for the board.',
  },
  {
    id: 'job-accounting-2',
    family: 'accounting',
    title: 'Accounts Payable Clerk',
    role: 'Finance',
    requiredSkills: ['Invoice processing', 'Xero', 'Reconciliation'],
    businessProblem: null,
    description: 'Process supplier invoices and keep the purchase ledger accurate.',
  },
  {
    id: 'job-marketing-1',
    family: 'marketing',
    title: 'Digital Marketing Manager',
    role: 'Marketing',
    requiredSkills: ['Paid social', 'Campaign planning', 'Google Analytics'],
    businessProblem: 'Acquisition cost per signup has doubled this year.',
    description: 'Plan and run paid and organic campaigns across digital channels.',
  },
  {
    id: 'job-marketing-2',
    family: 'marketing',
    title: 'SEO and Content Specialist',
    role: 'Marketing',
    requiredSkills: ['Keyword research', 'Copywriting', 'Technical SEO'],
    businessProblem: null,
    description: 'Grow organic search traffic through content and on-site optimisation.',
  },
];

export const EVAL_CANDIDATES: EvalCandidate[] = [
  // software
  { id: 'c-sw-1', family: 'software', title: 'Frontend Developer', brief: 'Four years building React apps for e-commerce.' },
  { id: 'c-sw-2', family: 'software', title: 'Web Developer', brief: 'Builds responsive sites in TypeScript and CSS.' },
  { id: 'c-sw-3', family: 'software', title: 'Full Stack Developer', brief: 'Node backend, PostgreSQL, and React frontend.' },
  { id: 'c-sw-4', family: 'software', title: 'Software Engineer', brief: null },
  // data
  { id: 'c-data-1', family: 'data', title: 'BI Analyst', brief: 'Builds Tableau dashboards for finance teams.' },
  { id: 'c-data-2', family: 'data', title: 'Data Scientist', brief: 'Machine learning models in Python and scikit-learn.' },
  { id: 'c-data-3', family: 'data', title: 'Reporting Analyst', brief: 'SQL reporting and retention analysis.' },
  { id: 'c-data-4', family: 'data', title: 'Analytics Consultant', brief: null },
  // product
  { id: 'c-prod-1', family: 'product', title: 'Product Owner', brief: 'Runs backlog refinement and sprint planning.' },
  { id: 'c-prod-2', family: 'product', title: 'Associate PM', brief: 'Customer research and roadmap support.' },
  { id: 'c-prod-3', family: 'product', title: 'Head of Product', brief: 'Led product strategy for a SaaS scale-up.' },
  { id: 'c-prod-4', family: 'product', title: 'Product Analyst', brief: 'Experiment design and user funnels.' },
  // nursing
  { id: 'c-nurse-1', family: 'nursing', title: 'Registered Nurse', brief: 'Medical ward experience, medication round lead.' },
  { id: 'c-nurse-2', family: 'nursing', title: 'Staff Nurse', brief: null },
  { id: 'c-nurse-3', family: 'nursing', title: 'District Nurse', brief: 'Home visits and wound dressing.' },
  { id: 'c-nurse-4', family: 'nursing', title: 'ICU Nurse', brief: 'Critical care, ventilated patients.' },
  // accounting
  { id: 'c-acc-1', family: 'accounting', title: 'Management Accountant', brief: 'ACCA qualified, month-end and forecasting.' },
  { id: 'c-acc-2', family: 'accounting', title: 'Accounts Clerk', brief: 'Purchase ledger and supplier invoices in Xero.' },
  { id: 'c-acc-3', family: 'accounting', title: 'Financial Controller', brief: 'Group reporting and audit liaison.' },
  { id: 'c-acc-4', family: 'accounting', title: 'Bookkeeper', brief: null },
  // marketing
  { id: 'c-mkt-1', family: 'marketing', title: 'Growth Marketer', brief: 'Paid social and performance campaigns.' },
  { id: 'c-mkt-2', family: 'marketing', title: 'SEO Specialist', brief: 'Keyword strategy and technical audits.' },
  { id: 'c-mkt-3', family: 'marketing', title: 'Content Marketer', brief: 'Copywriting and blog content for B2B.' },
  { id: 'c-mkt-4', family: 'marketing', title: 'Brand Manager', brief: null },
];
