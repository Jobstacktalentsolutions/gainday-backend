import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export function createDbPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
  });
}

export function createDb(pool: Pool) {
  return drizzle(pool);
}
