import type { DrizzleDb } from '../../db/client';

/** Either the shared db handle or a transaction handle — both expose the query builders. */
export type DbExecutor = Pick<DrizzleDb, 'select' | 'insert' | 'update'>;
