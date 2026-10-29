import { sql } from 'drizzle-orm';
import { DrizzleDb } from '../../../db/client';
import { questionBank } from '../../../db/schema/question-bank.schema';
import { roleScopeKey } from '../roles/category-routing';

export interface NoveltyMatch {
  id: string;
  taskType: string;
  distance: number;
  scenario: string | null;
}

function embeddingToPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Compares against tasks of the same role and sub-role only. The stored category is normalised the
 * same way as roleScopeKey, so legacy spacing or casing still lands in the same pool.
 */
export async function findSimilarQuestions(
  db: DrizzleDb,
  category: string,
  embedding: number[],
  topK: number,
): Promise<NoveltyMatch[]> {
  const vectorLiteral = embeddingToPgVectorLiteral(embedding);
  const scopeKey = roleScopeKey(category);

  const result = await db.execute<{
    id: string;
    task_type: string;
    distance: number;
    scenario: string | null;
  }>(sql`
    SELECT
      id,
      task_type,
      (embedding <=> ${vectorLiteral}::vector) AS distance,
      task_content->>'scenarioDescription' AS scenario
    FROM ${questionBank}
    WHERE regexp_replace(lower(trim(category)), '\\s*>\\s*', ' > ', 'g') = ${scopeKey}
    ORDER BY distance ASC
    LIMIT ${topK}
  `);

  return result.rows.map((row) => ({
    id: row.id,
    taskType: row.task_type,
    distance: Number(row.distance),
    scenario: row.scenario,
  }));
}
