import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { fuzzySearch, fuzzySearchArray } from './fuzzy-search';

const databaseUrl = process.env.FUZZY_SEARCH_TEST_DATABASE_URL;

(databaseUrl ? describe : describe.skip)('PostgreSQL fuzzy search', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  afterAll(() => pool.end());

  it('matches partial text, typos and skill arrays without treating wildcards as patterns', async () => {
    const query = async (term: string) => db.execute<{ title: string }>(sql`
      SELECT title FROM (VALUES
        ('Software Engineer', ARRAY['TypeScript']),
        ('Product Manager', ARRAY['Research']),
        ('100% remote', ARRAY[]::text[])
      ) AS sample(title, skills)
      WHERE ${fuzzySearch(term, [sql`title`])} OR ${fuzzySearchArray(term, sql`skills`)}
    `);
    expect((await query('engineer')).rows.map((row) => row.title)).toContain('Software Engineer');
    expect((await query('enginer')).rows.map((row) => row.title)).toContain('Software Engineer');
    expect((await query('typescrip')).rows.map((row) => row.title)).toContain('Software Engineer');
    expect((await query('%')).rows.map((row) => row.title)).toEqual(['100% remote']);
  });
});
