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

/** Removes markdown syntax, keeping the words. Descriptions are stored as markdown, and the email
 *  is plain text, so headings, emphasis, list markers, links, and code ticks would show literally. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/(^|\s)#{1,6}(?=\s)/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|\s)\*([^*\s][^*]*)\*(?=[\s.,;:!?]|$)/g, '$1$2')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The first few lines of a job description as plain text. Ends with "..." when anything was left
 * out, whether whole lines or the cut to the length limit.
 */
export function descriptionSnippet(description: string | null): string | null {
  if (!description) return null;
  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let text = stripMarkdown(lines.slice(0, SNIPPET_MAX_LINES).join(' '));
  let truncated = lines.length > SNIPPET_MAX_LINES;

  if (text.length > SNIPPET_MAX_CHARS) {
    const cut = text.slice(0, SNIPPET_MAX_CHARS);
    const lastSpace = cut.lastIndexOf(' ');
    text = cut
      .slice(0, lastSpace > 0 ? lastSpace : SNIPPET_MAX_CHARS)
      .trimEnd();
    truncated = true;
  }
  if (text === '') return null;
  return truncated ? `${text}...` : text;
}

/** "London · Remote-friendly", or null when neither is known. */
export function locationLine(
  job: Pick<RecommendedJob, 'location' | 'isRemoteFriendly'>,
): string | null {
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
