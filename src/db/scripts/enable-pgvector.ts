/**
 * One-time script: enables the pgvector extension on the database
 * pointed to by DATABASE_URL. Required before any `vector` column
 * (question bank embeddings) can be created.
 *
 * Run manually with: pnpm db:enable-pgvector
 * Not run automatically on app startup or build.
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('Enabling pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

    const { rows } = await client.query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';",
    );

    if (rows.length === 0) {
      throw new Error(
        'pgvector extension was not found after CREATE EXTENSION.',
      );
    }

    console.log(`pgvector enabled: ${rows[0].extname}@${rows[0].extversion}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed to enable pgvector:', err.message);
  process.exit(1);
});
