import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, isNotNull } from 'drizzle-orm';
import { jobs, SalaryRange } from '../schema';
import { toSalaryBound } from '../../modules/jobs/salary-bound.util';

// Rewrites salary bounds stored as 0 to null, using the same rule the write path applies.
// Dry run by default; pass --apply to write the changes.
const APPLY = process.argv.includes('--apply');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: { jobs } });

  const rows = await db
    .select({ id: jobs.id, title: jobs.title, salaryRange: jobs.salaryRange })
    .from(jobs)
    .where(isNotNull(jobs.salaryRange));

  const fixes = rows.flatMap((row) => {
    const current = row.salaryRange;
    if (!current) return [];
    const next: SalaryRange = {
      min: toSalaryBound(current.min),
      max: toSalaryBound(current.max),
      currency: current.currency,
    };
    if (next.min === current.min && next.max === current.max) return [];
    return [{ id: row.id, title: row.title, before: current, after: next }];
  });

  console.log(`${fixes.length} of ${rows.length} jobs store a zero salary bound.`);
  for (const fix of fixes) {
    console.log(
      `  ${fix.id} "${fix.title}": ${JSON.stringify(fix.before)} -> ${JSON.stringify(fix.after)}`,
    );
  }

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to write these changes.');
  } else {
    for (const fix of fixes) {
      await db
        .update(jobs)
        .set({ salaryRange: fix.after })
        .where(eq(jobs.id, fix.id));
    }
    console.log(`Updated ${fixes.length} jobs.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Normalising zero salaries failed:', err.message);
  process.exit(1);
});
