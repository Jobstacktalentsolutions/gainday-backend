/** A job as shown in a recommendation email. `location` and `description` come from the job row
 *  and are null when the employer didn't fill them in. */
export interface RecommendedJob {
  id: string;
  title: string;
  location: string | null;
  isRemoteFriendly: boolean;
  description: string | null;
}

const SNIPPET_MAX_LINES = 3;
const SNIPPET_MAX_CHARS = 280;

/** The first few non-empty lines of a job description, cut at a word boundary. */
export function descriptionSnippet(description: string | null): string | null {
  if (!description) return null;
  const text = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, SNIPPET_MAX_LINES)
    .join(' ');
  if (text.length <= SNIPPET_MAX_CHARS) return text;

  const cut = text.slice(0, SNIPPET_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : SNIPPET_MAX_CHARS).trimEnd()}…`;
}

/** "London · Remote-friendly", or null when neither is known. */
export function locationLine(job: Pick<RecommendedJob, 'location' | 'isRemoteFriendly'>): string | null {
  const parts = [
    job.location,
    job.isRemoteFriendly ? 'Remote-friendly' : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Subject and template context for the job-recommendations email. Used by the real sender and by
 *  the test-send script, so both produce the same email. */
export function buildJobRecommendationsEmail(input: {
  appUrl: string;
  candidateName: string;
  jobs: RecommendedJob[];
  unsubscribeUrl: string;
  year: number;
}) {
  const count = input.jobs.length;
  return {
    subject: `${count} new ${count === 1 ? 'job matches' : 'jobs match'} your job title`,
    context: {
      candidateName: input.candidateName,
      jobs: input.jobs.map((job) => ({
        title: job.title,
        url: `${input.appUrl}/job-board/${job.id}`,
        location: locationLine(job),
        snippet: descriptionSnippet(job.description),
      })),
      jobBoardUrl: `${input.appUrl}/job-board`,
      unsubscribeUrl: input.unsubscribeUrl,
      year: input.year,
    },
  };
}
