import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { jobs, employerProfiles, users } from '../schema';

const EMPLOYER_EMAIL = process.env.SEED_EMPLOYER_EMAIL || 'enweremproper2@gmail.com';

const DRAFT_JOBS = [
  {
    title: 'Senior Financial Analyst',
    role: 'FINANCE' as const,
    skillLevel: 'Senior',
    skillCategory: 'Financial Modeling',
    location: 'London, UK',
    employmentType: 'Full-time',
    isRemoteFriendly: true,
    salaryFrom: 55000,
    salaryTo: 75000,
    companyDescription:
      'We help mid-market businesses make sharper capital allocation decisions through rigorous financial modeling and forecasting.',
    skills: ['Financial Modeling', 'Excel', 'Forecasting', 'Valuation'],
    description:
      'We are looking for a Senior Financial Analyst to own our quarterly forecasting process, build investor-ready models, and partner with department heads on budget planning. You will be the analytical backbone behind major capital decisions.',
  },
  {
    title: 'Enterprise Sales Executive',
    role: 'SALES' as const,
    skillLevel: 'Mid-level',
    skillCategory: 'B2B Sales',
    location: 'Remote',
    employmentType: 'Full-time',
    isRemoteFriendly: true,
    salaryFrom: 45000,
    salaryTo: 65000,
    companyDescription:
      'A fast-growing SaaS platform serving enterprise finance teams across EMEA.',
    skills: ['B2B Sales', 'Negotiation', 'CRM', 'Pipeline Management'],
    description:
      'Own a full-cycle enterprise sales pipeline from prospecting through close. You will work closely with our SDR team and product marketing to hit quarterly revenue targets across our EMEA book of business.',
  },
  {
    title: 'Junior Accountant',
    role: 'FINANCE' as const,
    skillLevel: 'Entry-level',
    skillCategory: 'Bookkeeping',
    location: 'Manchester, UK',
    employmentType: 'Full-time',
    isRemoteFriendly: false,
    salaryFrom: 26000,
    salaryTo: 32000,
    companyDescription:
      'A boutique accounting firm serving small and medium businesses across the North West.',
    skills: ['Bookkeeping', 'Reconciliation', 'Xero', 'VAT Returns'],
    description:
      'Support our client accounting team with day-to-day bookkeeping, reconciliations, and VAT return preparation. Great entry point for someone building toward ACCA qualification.',
  },
  {
    title: 'Sales Development Representative',
    role: 'SALES' as const,
    skillLevel: 'Entry-level',
    skillCategory: 'Outbound Prospecting',
    location: 'Remote',
    employmentType: 'Full-time',
    isRemoteFriendly: true,
    salaryFrom: 28000,
    salaryTo: 34000,
    companyDescription:
      'A fast-growing SaaS platform serving enterprise finance teams across EMEA.',
    skills: ['Outbound Prospecting', 'Cold Calling', 'CRM', 'Email Sequencing'],
    description:
      'Generate and qualify pipeline for our Enterprise Account Executives through outbound calls, emails, and social selling. This is a launchpad role into full-cycle sales within 12-18 months.',
  },
  {
    title: 'FP&A Manager',
    role: 'FINANCE' as const,
    skillLevel: 'Senior',
    skillCategory: 'Financial Planning & Analysis',
    location: 'Leeds, UK',
    employmentType: 'Full-time',
    isRemoteFriendly: true,
    salaryFrom: 65000,
    salaryTo: 85000,
    companyDescription:
      'We help mid-market businesses make sharper capital allocation decisions through rigorous financial modeling and forecasting.',
    skills: ['FP&A', 'Board Reporting', 'Scenario Planning', 'SQL'],
    description:
      'Lead our FP&A function, owning monthly board reporting, scenario planning, and long-range financial models. You will manage one analyst and report directly to the CFO.',
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: { jobs, employerProfiles, users } });

  const [row] = await db
    .select({ profileId: employerProfiles.id })
    .from(employerProfiles)
    .innerJoin(users, eq(employerProfiles.userId, users.id))
    .where(eq(users.email, EMPLOYER_EMAIL));

  if (!row) {
    throw new Error(
      `No employer profile found for ${EMPLOYER_EMAIL}. Set SEED_EMPLOYER_EMAIL to an existing employer's email, or sign up an employer account first.`,
    );
  }

  console.log(`Seeding ${DRAFT_JOBS.length} draft jobs for employer_profiles.id=${row.profileId} (${EMPLOYER_EMAIL})...`);

  for (const job of DRAFT_JOBS) {
    const { salaryFrom, salaryTo, skills, ...rest } = job;
    const [inserted] = await db
      .insert(jobs)
      .values({
        ...rest,
        requiredSkills: skills,
        salaryRange: { min: salaryFrom, max: salaryTo, currency: 'GBP' },
        status: 'DRAFT',
        employerId: row.profileId,
      })
      .returning({ id: jobs.id, title: jobs.title });
    console.log(`  created draft job: ${inserted.title} (${inserted.id})`);
  }

  console.log('Done.');
  await pool.end();
}

main().catch((err) => {
  console.error('Seeding draft jobs failed:', err.message);
  process.exit(1);
});
