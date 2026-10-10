import { z } from 'zod';
import { Logger } from '@nestjs/common';

const logger = new Logger('ParsedJobDescriptionSchema');

// Structured output for POST /jobs/parse-description — takes a recruiter's raw, unstructured job
// description text and both (a) extracts the fields the employer job-posting form knows about,
// normalized directly to the values the frontend expects (no fuzzy-matching needed on that side),
// and (b) rewrites the description itself into a clean, candidate-facing markdown writeup.
export const parsedJobDescriptionSchema = z.object({
  title: z
    .string()
    .nullable()
    .describe(
      'The job title, if stated or clearly implied. Null if not determinable.',
    ),
  role: z
    .string()
    .nullable()
    .describe(
      'A short label (2-4 words) for the broad role domain this posting belongs to, e.g. ' +
        '"Finance", "Sales", "Customer Support", "Logistics". Use the posting\'s own terms — do ' +
        'not force it into any fixed list. Null only if genuinely undeterminable.',
    ),
  skillLevel: z
    .enum(['Entry level', 'Mid level', 'Senior level'])
    .nullable()
    .describe(
      'Seniority level implied by the posting (years of experience, title seniority, scope of responsibility). Must be exactly one of "Entry level", "Mid level", or "Senior level". Null if not determinable.',
    ),
  skillCategory: z
    .string()
    .nullable()
    .describe(
      'A short, specific sub-domain or specialism within the role, e.g. "Credit Risk", "Reconciliation", "Enterprise Sales". Null if not evident.',
    ),
  location: z
    .string()
    .nullable()
    .describe(
      'The job location as stated (city/country or "Remote"). Null if not stated.',
    ),
  employmentType: z
    .enum(['Full-time', 'Part-time', 'Contract'])
    .nullable()
    .describe(
      'Must be exactly one of "Full-time", "Part-time", or "Contract". Null if not stated.',
    ),
  // No date-format instruction needed in the prompt — the model can write the deadline however
  // it naturally reads it from the text ("March 15, 2027", "15 March 2027", etc.); this transform
  // normalizes whatever comes back into a strict "YYYY-MM-DD" string (or null) so downstream code
  // (the DTOs' @IsISO8601() validators) never sees a malformed value. A value JS's Date can't
  // parse is dropped to null rather than passed through broken or invented — logged so a
  // persistent parsing miss is visible instead of silently becoming a null deadline.
  deadline: z
    .string()
    .nullable()
    .describe(
      'Application deadline, in whatever format it appears in the text, only if an explicit date is stated. Null otherwise — never invent one.',
    )
    .transform((raw) => {
      if (!raw) return null;
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        logger.warn(
          `Model returned an unparsable deadline value "${raw}" — dropping to null`,
        );
        return null;
      }
      return parsed.toISOString().slice(0, 10);
    }),
  isRemoteFriendly: z
    .boolean()
    .nullable()
    .describe(
      'True if the posting explicitly allows remote or hybrid work, false if it explicitly requires on-site, null if not addressed.',
    ),
  salaryFrom: z
    .number()
    .nullable()
    .describe(
      'Lower bound of the stated salary range, as a plain number. Null if not stated.',
    ),
  salaryTo: z
    .number()
    .nullable()
    .describe(
      'Upper bound of the stated salary range, as a plain number. Null if not stated.',
    ),
  companyDescription: z
    .string()
    .nullable()
    .describe(
      'A short description of what the company does, only if the posting actually describes the company. Null otherwise.',
    ),
  skills: z
    .array(z.string())
    .nullable()
    .describe(
      'The specific skills, tools, or competencies the posting calls out as required or preferred, as short tags (e.g. "Excel", "Stakeholder communication"). Null or empty if none are evident.',
    ),
  formattedDescription: z
    .string()
    .describe(
      'A cleaned-up, well-structured rewrite of the job description as GitHub-flavored markdown, rendered by a real markdown parser. Use real "## Heading" syntax for section titles (never bold text as a stand-in for a heading), and real "- item" markdown lists (one item per line, never items strung together inline) for any enumerable content like responsibilities or requirements. Preserve all substantive content from the original text (responsibilities, requirements, context); do not invent new claims. This field is always produced, even if other fields above are null.',
    ),
  businessProblem: z
    .string()
    .nullable()
    .describe(
      'The specific business problem or challenge the posting says this hire should help solve, ONLY if one is explicitly stated in the text (e.g. "reduce onboarding drop-off", "fix a backlog of overdue reconciliations"). Return null — never invent or infer one — if the posting is only a general role description with no specific problem called out.',
    ),
});

export type ParsedJobDescription = z.infer<typeof parsedJobDescriptionSchema>;
