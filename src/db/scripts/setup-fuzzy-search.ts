import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    for (const column of ['title', 'role', 'location', 'skill_category'] as const) {
      await pool.query(`CREATE INDEX IF NOT EXISTS jobs_${column}_trgm_idx ON jobs USING gin (${column} gin_trgm_ops)`);
    }
    console.log('Fuzzy search extension and job indexes are ready.');
  } finally {
    await pool.end();
  }
}

main().catch((error: Error) => {
  console.error('Fuzzy search setup failed:', error.message);
  process.exitCode = 1;
});
