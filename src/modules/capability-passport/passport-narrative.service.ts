import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { GRADING_MODEL } from '../ai/ai.constants';
import { withGeminiSafeStructuredOutput } from '../ai/gemini-structured-output.util';
import { JobSeekerProfileService } from '../users/job-seeker-profile.service';
import { PassportNarrative } from '../../db/schema';
import { passportNarrativeResultSchema } from './schemas/passport-narrative-result.schema';
import {
  buildPassportNarrativePrompt,
  PassportNarrativeInput,
} from './prompts/passport-narrative.prompt';

const FALLBACK_NARRATIVE: Pick<
  PassportNarrative,
  'whatStoodOut' | 'improvementSuggestions'
> = {
  whatStoodOut: '',
  improvementSuggestions: [],
};

@Injectable()
export class PassportNarrativeService {
  private readonly logger = new Logger(PassportNarrativeService.name);

  constructor(
    @Inject(GRADING_MODEL) private readonly gradingModel: BaseChatModel,
    private readonly jobSeekerProfileService: JobSeekerProfileService,
  ) {}

  /**
   * Returns the cached narrative for the candidate, regenerating it first if the last-3-graded-
   * submission ids have moved on since it was cached (or if there's never been one). Generation
   * failures fall back to whatever is currently cached (possibly stale, possibly never-set)
   * rather than failing the whole passport request — the numeric passport data is still useful
   * on its own.
   */
  async getOrRegenerate(
    profileId: string,
    recentSubmissionIds: string[],
    buildInput: () => PassportNarrativeInput,
  ): Promise<
    Pick<PassportNarrative, 'whatStoodOut' | 'improvementSuggestions'>
  > {
    const cached =
      await this.jobSeekerProfileService.getPassportNarrative(profileId);
    const isStale =
      !cached ||
      cached.basedOnSubmissionIds.length !== recentSubmissionIds.length ||
      cached.basedOnSubmissionIds.some(
        (id, index) => id !== recentSubmissionIds[index],
      );
    if (!isStale) {
      return cached;
    }

    try {
      const generated = await this.generate(buildInput());
      const narrative: PassportNarrative = {
        whatStoodOut: generated.whatStoodOut,
        improvementSuggestions: generated.improvementSuggestions.map(
          (suggestion) => ({ id: randomUUID(), ...suggestion }),
        ),
        basedOnSubmissionIds: recentSubmissionIds,
        generatedAt: new Date().toISOString(),
      };
      await this.jobSeekerProfileService.setPassportNarrative(
        profileId,
        narrative,
      );
      return narrative;
    } catch (error) {
      this.logger.error(
        `Passport narrative generation failed for job seeker profile ${profileId}: ` +
          `${error instanceof Error ? error.message : error}`,
      );
      return cached ?? FALLBACK_NARRATIVE;
    }
  }

  private async generate(input: PassportNarrativeInput) {
    const model = withGeminiSafeStructuredOutput(
      this.gradingModel,
      passportNarrativeResultSchema,
    );
    return model.invoke([
      new SystemMessage(buildPassportNarrativePrompt()),
      new HumanMessage(JSON.stringify(input)),
    ]);
  }
}
