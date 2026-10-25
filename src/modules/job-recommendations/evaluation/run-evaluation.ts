/**
 * Offline check of the matcher. Embeds the labelled fixtures with the same model and text builders
 * the app uses, then scores every candidate against every job. Reads nothing from and writes
 * nothing to the database, and sends no notifications.
 *
 * Run with: pnpm recs:evaluate
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { aiConfig } from '../../../config/ai.config';
import { jobRecommendationConfig } from '../../../config/job-recommendations.config';
import {
  buildCandidateMatchText,
  buildJobMatchText,
  CandidateMatch,
} from '../job-recommendation.util';
import { EVAL_CANDIDATES, EVAL_JOBS } from './fixtures';
import {
  cosineSimilarity,
  mean,
  rankingQuality,
  scoreSelection,
  selectMatches,
} from './metrics';

const { maxPerCandidate, minPerCandidate, minScore } = jobRecommendationConfig;
const THRESHOLDS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85];

const round = (value: number) => Number(value.toFixed(3));

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Set GEMINI_API_KEY or GOOGLE_API_KEY in .env');
  }

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey,
    model: aiConfig.gemini.embeddingModel,
  });
  const jobVectors = await embeddings.embedDocuments(
    EVAL_JOBS.map((job) => buildJobMatchText(job)),
  );
  const candidateVectors = await embeddings.embedDocuments(
    EVAL_CANDIDATES.map((c) => buildCandidateMatchText(c.title, c.brief)),
  );

  const jobById = new Map(EVAL_JOBS.map((job) => [job.id, job]));
  const candidateById = new Map(EVAL_CANDIDATES.map((c) => [c.id, c]));
  const isCorrect = (match: CandidateMatch) =>
    jobById.get(match.jobId)?.family ===
    candidateById.get(match.candidateId)?.family;

  const pairs: CandidateMatch[] = EVAL_CANDIDATES.flatMap((candidate, ci) =>
    EVAL_JOBS.map((job, ji) => ({
      candidateId: candidate.id,
      jobId: job.id,
      score: cosineSimilarity(candidateVectors[ci], jobVectors[ji]),
    })),
  );
  const totalCorrect = pairs.filter(isCorrect).length;

  console.log(
    `\n${EVAL_CANDIDATES.length} candidates x ${EVAL_JOBS.length} jobs = ${pairs.length} pairs, ${totalCorrect} correct (same family)\n`,
  );

  // 1. Do the scores separate correct pairs from incorrect ones?
  const summarise = (scores: number[]) => ({
    count: scores.length,
    mean: round(mean(scores)),
    min: round(Math.min(...scores)),
    max: round(Math.max(...scores)),
  });
  console.log('Score spread');
  console.table({
    correct: summarise(pairs.filter(isCorrect).map((p) => p.score)),
    incorrect: summarise(
      pairs.filter((p) => !isCorrect(p)).map((p) => p.score),
    ),
  });

  // 2. For each job, are the right candidates ranked near the top?
  const rankingRows = EVAL_JOBS.map((job) => {
    const ranked = pairs
      .filter((p) => p.jobId === job.id)
      .sort((a, b) => b.score - a.score);
    const quality = rankingQuality(ranked.map(isCorrect), maxPerCandidate);
    const top = ranked.slice(0, maxPerCandidate).map((p) => {
      const title = candidateById.get(p.candidateId)?.title ?? '';
      return `${title} ${round(p.score)}${isCorrect(p) ? ' ✓' : ' ✗'}`;
    });
    return {
      job: job.title,
      'P@4': round(quality.precisionAtK),
      MRR: round(quality.reciprocalRank),
      top1: top[0],
      top2: top[1],
      top3: top[2],
      top4: top[3],
    };
  });
  console.log(`Ranking per job (top ${maxPerCandidate} shown)`);
  console.table(rankingRows);
  console.log(
    `Mean P@4 ${round(mean(rankingRows.map((row) => row['P@4'])))}, mean MRR ${round(mean(rankingRows.map((row) => row.MRR)))}\n`,
  );

  // 3. Threshold sweep with the production selection rule.
  const sweep = THRESHOLDS.map((threshold) => {
    const selected = selectMatches(pairs, {
      minScore: threshold,
      maxPerCandidate,
      minPerCandidate,
    });
    const quality = scoreSelection(selected, isCorrect, totalCorrect);
    return {
      minScore: threshold,
      current: threshold === minScore ? '<-' : '',
      candidatesNotified: `${quality.candidatesNotified}/${EVAL_CANDIDATES.length}`,
      emitted: quality.emitted,
      precision: round(quality.precision),
      recall: round(quality.recall),
    };
  });
  console.log(
    `Selection by threshold (maxPerCandidate ${maxPerCandidate}, minPerCandidate ${minPerCandidate})`,
  );
  console.table(sweep);

  // 4. Which candidates miss out at the configured threshold?
  const selectedNow = selectMatches(pairs, {
    minScore,
    maxPerCandidate,
    minPerCandidate,
  });
  const notified = new Set(selectedNow.map((m) => m.candidateId));
  const missed = EVAL_CANDIDATES.filter((c) => !notified.has(c.id)).map((c) => {
    const best = pairs
      .filter((p) => p.candidateId === c.id)
      .sort((a, b) => b.score - a.score)[0];
    return {
      candidate: c.title,
      family: c.family,
      bestJob: jobById.get(best.jobId)?.title ?? '',
      bestScore: round(best.score),
      bestIsCorrect: isCorrect(best),
    };
  });
  console.log(
    `Candidates notified at minScore ${minScore}: ${notified.size}/${EVAL_CANDIDATES.length}`,
  );
  if (missed.length > 0) {
    console.log('Not notified:');
    console.table(missed);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
