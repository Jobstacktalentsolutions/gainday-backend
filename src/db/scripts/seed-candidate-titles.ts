/**
 * Test helper: gives every candidate without a job title a random one, so the matcher has
 * something to work with. Only profiles whose title is null are touched.
 *
 * Dry run by default. Pass --apply to write.
 *   pnpm db:seed-candidate-titles               preview the titles
 *   pnpm db:seed-candidate-titles -- --apply    write them
 *
 * Undo: UPDATE job_seeker_profiles SET title = NULL WHERE id IN (...) using the ids printed on apply.
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { eq, isNull } from 'drizzle-orm';
import { createDb, createDbPool } from '../client';
import { jobSeekerProfiles } from '../schema';

const TITLES = [
  'Frontend Developer',
  'Software Engineer',
  'Full Stack Developer',
  'Data Analyst',
  'Data Scientist',
  'Product Manager',
  'Product Owner',
  'Registered Nurse',
  'Staff Nurse',
  'Management Accountant',
  'Accounts Clerk',
  'Digital Marketing Manager',
  'SEO Specialist',
  'Content Marketer',
  'Sales Executive',
  'Customer Success Manager',
  'HR Coordinator',
  'Operations Manager',
];

const pickRandom = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const apply = process.argv.includes('--apply');
  const pool = createDbPool(process.env.DATABASE_URL);
  const db = createDb(pool);

  try {
    const untitled = await db
      .select({
        id: jobSeekerProfiles.id,
        pronouns: jobSeekerProfiles.pronouns,
      })
      .from(jobSeekerProfiles)
      .where(isNull(jobSeekerProfiles.title));

    const plan = untitled.map((profile) => ({
      id: profile.id,
      title: pickRandom(TITLES),
      pronouns: profile.pronouns,
    }));

    console.log(`Target: ${new URL(process.env.DATABASE_URL).host}`);
    console.log(`${plan.length} candidate(s) without a title`);
    console.table(plan.map(({ id, title }) => ({ id, title })));

    if (!apply) {
      console.log(
        'Dry run: nothing written. Re-run with -- --apply to write these titles.',
      );
      return;
    }

    for (const { id, title, pronouns } of plan) {
      await db
        .update(jobSeekerProfiles)
        .set({
          title,
          // Same rule as JobSeekerProfileService.update: complete once pronouns and title are set.
          isProfileComplete: pronouns !== null,
          updatedAt: new Date(),
        })
        .where(eq(jobSeekerProfiles.id, id));
    }
    console.log(`Wrote titles to ${plan.length} candidate(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
