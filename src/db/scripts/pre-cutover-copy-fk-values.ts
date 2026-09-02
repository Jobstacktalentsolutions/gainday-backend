import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

// Runs after migration 0005_bitter_sage.sql's FK-constraint drops (jobs,
// submissions, generation_review_items no longer reference users) but
// before its column drops take effect on a re-run — actually: run this
// BEFORE applying 0005_bitter_sage.sql. That migration both drops the old
// FK constraints (users.id-referencing) and drops the transitional
// *_profile_id columns in the same file. Since drizzle-kit generate can't
// express data moves, this script must copy the already-backfilled profile
// ids from the transitional *_profile_id columns into the legacy columns
// while both still exist and neither is FK-constrained (this session
// intentionally dropped the .references() on the legacy columns in the
// schema files first, so no migration currently enforces users.id on them).
async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const jobsResult = await pool.query(
    `UPDATE jobs SET employer_id = employer_profile_id WHERE employer_profile_id IS NOT NULL`,
  );
  console.log(`jobs: copied employer_profile_id -> employer_id for ${jobsResult.rowCount} rows.`);

  const submissionsResult = await pool.query(
    `UPDATE submissions SET candidate_id = candidate_profile_id WHERE candidate_profile_id IS NOT NULL`,
  );
  console.log(
    `submissions: copied candidate_profile_id -> candidate_id for ${submissionsResult.rowCount} rows.`,
  );

  const reviewsResult = await pool.query(
    `UPDATE generation_review_items SET reviewed_by_admin_id = reviewed_by_admin_profile_id WHERE reviewed_by_admin_profile_id IS NOT NULL`,
  );
  console.log(
    `generation_review_items: copied reviewed_by_admin_profile_id -> reviewed_by_admin_id for ${reviewsResult.rowCount} rows.`,
  );

  const orphanedJobs = await pool.query(
    `SELECT count(*)::int AS count FROM jobs WHERE employer_profile_id IS NULL`,
  );
  const orphanedSubmissions = await pool.query(
    `SELECT count(*)::int AS count FROM submissions WHERE candidate_id IS NOT NULL AND candidate_profile_id IS NULL`,
  );
  const orphanedReviews = await pool.query(
    `SELECT count(*)::int AS count FROM generation_review_items WHERE reviewed_by_admin_id IS NOT NULL AND reviewed_by_admin_profile_id IS NULL`,
  );

  const jobsOrphanCount = orphanedJobs.rows[0].count;
  const submissionsOrphanCount = orphanedSubmissions.rows[0].count;
  const reviewsOrphanCount = orphanedReviews.rows[0].count;

  if (jobsOrphanCount > 0 || submissionsOrphanCount > 0 || reviewsOrphanCount > 0) {
    console.error(
      `WARNING: orphaned rows detected (jobs: ${jobsOrphanCount}, submissions: ${submissionsOrphanCount}, ` +
        `reviews: ${reviewsOrphanCount}). Do NOT proceed with the cutover migration until these are resolved.`,
    );
    process.exit(1);
  }

  console.log('No orphans detected. Safe to run the cutover migration now.');

  await pool.end();
}

main().catch((err) => {
  console.error('Pre-cutover copy failed:', err.message);
  process.exit(1);
});
