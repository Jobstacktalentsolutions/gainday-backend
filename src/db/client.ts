import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type DrizzleDb = NodePgDatabase<typeof schema>;

export function createDbPool(connectionString?: string): Pool {
  return new Pool({
    connectionString: connectionString || process.env.DATABASE_URL,
  });
}

export function createDb(pool: Pool): DrizzleDb {
  return drizzle(pool, { schema });
}
