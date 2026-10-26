import { and, count, eq } from 'drizzle-orm';
import type { DrizzleDb } from '../../db/client';
import { generationReviewItems } from '../../db/schema/generation-review.schema';

/** How many of a job's generated task slots are still waiting on an admin. */
export async function countPendingTaskReviews(
  db: DrizzleDb,
  jobId: string,
): Promise<number> {
  const [{ pendingCount }] = await db
    .select({ pendingCount: count() })
    .from(generationReviewItems)
    .where(
      and(
        eq(generationReviewItems.jobId, jobId),
        eq(generationReviewItems.status, 'PENDING'),
      ),
    );
  return pendingCount;
}
