/**
 * Shows which candidates the matcher would recommend for each active job, using the same query as
 * the scheduled pass. It writes only the embedding rows the matcher reads from. It creates no
 * recommendations, pass records or notifications, and sends no email.
 *
 * Run with: pnpm recs:preview            (the configured rules)
 *           pnpm recs:preview -- --all   (every score, no threshold, to see how close candidates came)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { aiConfig } from '../../config/ai.config';
import {
  jobRecommendationConfig,
  SelectionRules,
} from '../../config/job-recommendations.config';
import { createDb, createDbPool } from '../../db/client';
import { JobStatus, jobSeekerProfiles, jobs } from '../../db/schema';
import { JobMatchEmbeddingService } from './job-match-embedding.service';
import { findCandidateMatches } from './job-match-query';

const round = (value: number) => Number(value.toFixed(3));

const lookup = (map: Map<string, string | null>, id: string): string => {
  const value = map.get(id);
  if (value === undefined || value === null) {
    throw new Error(`No title for ${id}`);
  }
  return value;
};

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Set GEMINI_API_KEY or GOOGLE_API_KEY in .env');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = createDbPool(process.env.DATABASE_URL);
  const db = createDb(pool);

  try {
    const activeJobs = await db
      .select({ id: jobs.id, title: jobs.title, role: jobs.role })
      .from(jobs)
      .where(and(eq(jobs.status, JobStatus.ACTIVE), isNotNull(jobs.title)));
    if (activeJobs.length === 0) {
      console.log('No active jobs with a title, so there is nothing to match.');
      return;
    }

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey,
      model: aiConfig.gemini.embeddingModel,
    });
    const embedder = new JobMatchEmbeddingService(db, embeddings);
    await embedder.syncCandidates();
    await embedder.syncJobs(activeJobs.map((job) => job.id));

    const showAll = process.argv.includes('--all');
    const rules: SelectionRules = showAll
      ? { minScore: -1, maxPerCandidate: 1000, minPerCandidate: 1 }
      : jobRecommendationConfig;
    const matches = await findCandidateMatches(
      db,
      activeJobs.map((job) => job.id),
      rules,
    );

    const candidateIds = [...new Set(matches.map((match) => match.candidateId))];
    const candidates = candidateIds.length
      ? await db
          .select({ id: jobSeekerProfiles.id, title: jobSeekerProfiles.title })
          .from(jobSeekerProfiles)
          .where(inArray(jobSeekerProfiles.id, candidateIds))
      : [];
    const candidateTitle = new Map(candidates.map((c) => [c.id, c.title]));
    const jobTitle = new Map(activeJobs.map((job) => [job.id, job.title]));

    const rows = matches
      .map((match) => ({
        job: lookup(jobTitle, match.jobId),
        candidate: lookup(candidateTitle, match.candidateId),
        candidateId: match.candidateId.slice(0, 8),
        score: round(match.score),
      }))
      .sort((a, b) => a.job.localeCompare(b.job) || b.score - a.score);

    console.log(
      showAll
        ? 'Rules: none (showing every score)'
        : `Rules: minScore ${rules.minScore}, max ${rules.maxPerCandidate} per candidate, min ${rules.minPerCandidate}`,
    );
    console.log(`${activeJobs.length} active job(s) with a title\n`);

    if (rows.length === 0) {
      console.log('No candidate clears the rules for these jobs.');
      return;
    }
    console.table(rows);

    const notified = new Set(matches.map((m) => m.candidateId));
    console.log(
      `${notified.size} candidate(s) would be notified, receiving ${matches.length} recommendation(s) in total.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Preview failed:', err.message);
  process.exit(1);
});
