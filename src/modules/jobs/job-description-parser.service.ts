import { Inject, Injectable, Logger } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GENERATION_MODEL } from '../ai/ai.constants';
import { withGeminiSafeStructuredOutput } from '../ai/gemini-structured-output.util';
import {
  parsedJobDescriptionSchema,
  ParsedJobDescription,
} from './schemas/parsed-job-description.schema';

const logger = new Logger('JobDescriptionParserService');

const PARSE_PROMPT = `You are helping an employer turn a rough, unstructured job description into a
structured job posting. Given the raw text below, extract every field you can determine and rewrite
the description itself into a clean, well-formatted, candidate-facing job description in
GitHub-flavored markdown.

Rules:
- Never invent information that is not present in the text — return null for any field you cannot
  determine from the text.
- Normalize enum-shaped fields (skillLevel, employmentType) to exactly one of the allowed values
  described on each field — do not return any other spelling or value. "role" is free text — use
  a short label in the posting's own terms rather than forcing it into a fixed list.
- The rewritten description should preserve all substantive content (responsibilities,
  requirements, context) from the original — it's a cleanup and reformat, not a summary that drops
  information.
- Omit any application instructions, CV/resume submission details, or links/methods on how to apply.
- Only extract businessProblem if the text explicitly names a specific problem this hire should
  solve — a generic role description with no such problem stated means null.
- Formatting is rendered by a real markdown parser on the candidate-facing page, so use actual
  markdown syntax, not bold text standing in for it:
  - Section titles (e.g. "About the role", "Key responsibilities", "Required experience &
    skills") must be real headings ("## Section title" or "###", not "**Section title**" as a
    bolded line of body text).
  - Any enumerable set of items (responsibilities, requirements, benefits, etc.) must be a real
    markdown list — one "- item" per line — never items strung together inline separated by
    " - " on a single line or paragraph.
  - Put a blank line between a heading and the text/list that follows it, and between a list and
    the next heading or paragraph, so each renders as its own distinct block.
  - Do not repeat the job title as a top-level "# Heading" inside the description — the title is
    already shown separately on the page; start the description straight with its content.`;

@Injectable()
export class JobDescriptionParserService {
  constructor(
    @Inject(GENERATION_MODEL) private readonly generationModel: BaseChatModel,
  ) {}

  async parse(rawText: string): Promise<Partial<ParsedJobDescription>> {
    logger.log(`Parsing raw job description (${rawText.length} chars)`);

    const model = withGeminiSafeStructuredOutput(
      this.generationModel,
      parsedJobDescriptionSchema,
    );

    const result = await model.invoke([
      new SystemMessage(PARSE_PROMPT),
      new HumanMessage(rawText),
    ]);

    logger.log(
      `Parsed job description: title="${result.title ?? 'null'}", role=${result.role ?? 'null'}, businessProblem=${result.businessProblem ? 'present' : 'null'}`,
    );

    return this.omitUnspecified({
      ...result,
      deadline: this.normalizeDeadline(result.deadline),
    });
  }

  // Strict structured output forces the model to emit every field, so a field the text never
  // mentioned comes back as null or as an "empty" filler (0 salary, "" string, [] list). Those
  // aren't real values — drop them so the response only carries what the posting actually
  // specified, instead of the frontend prefilling the form with filler. `false` is kept: it is a
  // legitimate answer for isRemoteFriendly (explicitly on-site).
  private omitUnspecified(
    parsed: ParsedJobDescription,
  ): Partial<ParsedJobDescription> {
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => {
        if (value === null || value === 0) return false;
        if (typeof value === 'string') return value.trim() !== '';
        if (Array.isArray(value)) return value.length > 0;
        return true;
      }),
    );
  }

  // Normalizes whatever date format the model read from the text into a strict "YYYY-MM-DD"
  // string so the DTOs' @IsISO8601() validators never see a malformed value. A value JS's Date
  // can't parse is dropped to null rather than passed through broken or invented — logged so a
  // persistent parsing miss is visible instead of silently becoming a null deadline.
  private normalizeDeadline(raw: string | null): string | null {
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      logger.warn(
        `Model returned an unparsable deadline value "${raw}" — dropping to null`,
      );
      return null;
    }
    return parsed.toISOString().slice(0, 10);
  }
}
