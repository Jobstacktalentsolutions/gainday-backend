import { sql } from 'drizzle-orm';
import { DrizzleDb } from '../../../db/client';
import { questionBank } from '../../../db/schema/question-bank.schema';

export interface NoveltyMatch {
  id: string;
  taskType: string;
  distance: number;
}

function embeddingToPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function findSimilarQuestions(
  db: DrizzleDb,
  category: string,
  embedding: number[],
  topK: number,
): Promise<NoveltyMatch[]> {
  const vectorLiteral = embeddingToPgVectorLiteral(embedding);

  const result = await db.execute<{ id: string; task_type: string; distance: number }>(sql`
    SELECT id, task_type, (embedding <=> ${vectorLiteral}::vector) AS distance
    FROM ${questionBank}
    WHERE category = ${category}
    ORDER BY distance ASC
    LIMIT ${topK}
  `);

  return result.rows.map((row) => ({
    id: row.id,
    taskType: row.task_type,
    distance: Number(row.distance),
  }));
}
