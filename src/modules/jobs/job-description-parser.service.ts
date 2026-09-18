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
- Normalize enum-shaped fields (role, skillLevel, employmentType) to exactly one of the allowed
  values described on each field — do not return any other spelling or value.
- The rewritten description should preserve all substantive content (responsibilities,
  requirements, context) from the original — it's a cleanup and reformat, not a summary that drops
  information.
- Only extract businessProblem if the text explicitly names a specific problem this hire should
  solve — a generic role description with no such problem stated means null. Don't give the
  business problem its own dedicated section in the rewritten description (it's captured
  separately in the businessProblem field) — just fold any necessary context from it naturally
  into the responsibilities section instead of restating it verbatim under its own heading.`;

@Injectable()
export class JobDescriptionParserService {
  constructor(
    @Inject(GENERATION_MODEL) private readonly generationModel: BaseChatModel,
  ) {}

  async parse(rawText: string): Promise<ParsedJobDescription> {
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

    return result;
  }
}
