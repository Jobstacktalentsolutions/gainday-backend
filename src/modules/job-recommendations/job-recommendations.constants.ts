export const JOB_RECOMMENDATIONS_QUEUE = 'job-recommendations';
export const RUN_JOB_RECOMMENDATIONS_JOB = 'run-job-recommendations';

export const jobRecommendationConfig = {
  // Twice a day, 09:00 and 18:00 UK time.
  cronPattern: '0 9,18 * * *',
  timezone: 'Europe/London',
  // Minimum cosine similarity between a candidate's and a job's embeddings. Tune on real matches:
  // embedding scores cluster high, so the right cut-off is only known from data.
  minScore: 0.7,
  maxPerCandidate: 4,
  minPerCandidate: 2,
};
