/**
 * Test helper: creates one synthetic job seeker per supported job title, with a complete profile,
 * so the matcher has a realistic spread to score. Accounts use @example.com addresses, and
 * EmailService drops mail sent to them. Existing addresses are skipped.
 *
 * Dry run by default. Pass --apply to write.
 *   pnpm db:seed-test-candidates               preview the candidates
 *   pnpm db:seed-test-candidates -- --apply    write them
 *
 * Undo: DELETE FROM users WHERE email LIKE '%@example.com'  (profiles cascade)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { inArray } from 'drizzle-orm';
import { createDb, createDbPool } from '../client';
import {
  jobSeekerProfiles,
  Pronouns,
  users,
  UserRole,
} from '../schema';

interface TestCandidate {
  title: string;
  fullName: string;
  pronouns: Pronouns;
  brief: string;
}

const TEST_CANDIDATES: TestCandidate[] = [
  {
    title: 'Frontend Developer',
    fullName: 'Priya Raman',
    pronouns: Pronouns.SHE_HER,
    brief: 'Builds React and TypeScript interfaces for B2B dashboards, with a focus on accessibility.',
  },
  {
    title: 'Software Engineer',
    fullName: 'Daniel Okafor',
    pronouns: Pronouns.HE_HIM,
    brief: 'Backend engineer with five years on Node.js and PostgreSQL services, mostly API design.',
  },
  {
    title: 'Full Stack Developer',
    fullName: 'Mei Lin',
    pronouns: Pronouns.SHE_HER,
    brief: 'Ships features end to end in Next.js and Django for early-stage SaaS teams.',
  },
  {
    title: 'Data Analyst',
    fullName: 'Tomás Rivera',
    pronouns: Pronouns.HE_HIM,
    brief: 'Builds SQL reporting and Power BI dashboards for retail operations and pricing.',
  },
  {
    title: 'Data Scientist',
    fullName: 'Amara Osei',
    pronouns: Pronouns.SHE_HER,
    brief: 'Works on churn prediction and forecasting models in Python, with experiment design.',
  },
  {
    title: 'Product Manager',
    fullName: 'Ben Carter',
    pronouns: Pronouns.HE_HIM,
    brief: 'Owns the roadmap for a consumer mobile app, from discovery through launch metrics.',
  },
  {
    title: 'Product Owner',
    fullName: 'Leila Haddad',
    pronouns: Pronouns.SHE_HER,
    brief: 'Manages the backlog for an agile payments team and writes clear acceptance criteria.',
  },
  {
    title: 'Registered Nurse',
    fullName: 'Grace Mensah',
    pronouns: Pronouns.SHE_HER,
    brief: 'Experienced in acute medical wards, medication safety and patient handover.',
  },
  {
    title: 'Staff Nurse',
    fullName: 'Oliver Brooks',
    pronouns: Pronouns.HE_HIM,
    brief: 'Works nights on a surgical ward, leading small teams and supporting new starters.',
  },
  {
    title: 'Management Accountant',
    fullName: 'Hannah Schmidt',
    pronouns: Pronouns.SHE_HER,
    brief: 'Prepares monthly management accounts, variance analysis and budget forecasts.',
  },
  {
    title: 'Accounts Clerk',
    fullName: 'Kwame Asante',
    pronouns: Pronouns.HE_HIM,
    brief: 'Handles accounts payable, bank reconciliations and month-end journals.',
  },
  {
    title: 'Digital Marketing Manager',
    fullName: 'Sofia Lindqvist',
    pronouns: Pronouns.SHE_HER,
    brief: 'Runs paid search and social campaigns, with a focus on conversion and budget.',
  },
  {
    title: 'SEO Specialist',
    fullName: 'Jordan Blake',
    pronouns: Pronouns.THEY_THEM,
    brief: 'Improves organic search traffic through technical audits and content strategy.',
  },
  {
    title: 'Content Marketer',
    fullName: 'Chloe Martin',
    pronouns: Pronouns.SHE_HER,
    brief: 'Writes blog, email and case-study content for B2B software brands.',
  },
  {
    title: 'Sales Executive',
    fullName: 'Marcus Johnson',
    pronouns: Pronouns.HE_HIM,
    brief: 'Closes mid-market deals through outbound prospecting and consultative demos.',
  },
  {
    title: 'Customer Success Manager',
    fullName: 'Aisha Khan',
    pronouns: Pronouns.SHE_HER,
    brief: 'Keeps enterprise accounts renewing through onboarding, QBRs and expansion planning.',
  },
  {
    title: 'HR Coordinator',
    fullName: 'Ethan Park',
    pronouns: Pronouns.HE_HIM,
    brief: 'Coordinates recruitment logistics, onboarding paperwork and employee records.',
  },
  {
    title: 'Operations Manager',
    fullName: 'Nadia Petrova',
    pronouns: Pronouns.SHE_HER,
    brief: 'Oversees day-to-day operations for a logistics warehouse, including staffing and KPIs.',
  },
];

const emailFor = (title: string): string =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com`;

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const apply = process.argv.includes('--apply');
  const pool = createDbPool(process.env.DATABASE_URL);
  const db = createDb(pool);

  try {
    const existing = await db
      .select({ email: users.email })
      .from(users)
      .where(inArray(users.email, TEST_CANDIDATES.map((c) => emailFor(c.title))));
    const existingEmails = new Set(existing.map((row) => row.email));
    const plan = TEST_CANDIDATES.filter(
      (candidate) => !existingEmails.has(emailFor(candidate.title)),
    );

    console.log(`Target: ${new URL(process.env.DATABASE_URL).host}`);
    console.log(
      `${plan.length} test candidate(s) to create, ${existingEmails.size} already exist`,
    );
    console.table(
      plan.map((candidate) => ({
        email: emailFor(candidate.title),
        title: candidate.title,
        fullName: candidate.fullName,
      })),
    );

    if (!apply) {
      console.log(
        'Dry run: nothing written. Re-run with -- --apply to write these candidates.',
      );
      return;
    }

    for (const candidate of plan) {
      await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            email: emailFor(candidate.title),
            role: UserRole.JOB_SEEKER,
            isEmailVerified: true,
          })
          .returning({ id: users.id });
        await tx.insert(jobSeekerProfiles).values({
          userId: user.id,
          fullName: candidate.fullName,
          title: candidate.title,
          pronouns: candidate.pronouns,
          brief: candidate.brief,
          isProfileComplete: true,
        });
      });
    }
    console.log(`Created ${plan.length} test candidate(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
