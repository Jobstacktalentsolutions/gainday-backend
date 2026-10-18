import { PassportNarrativeService } from './passport-narrative.service';
import { PassportNarrative } from '../../db/schema';

const PROFILE_ID = 'profile-1';

const cachedNarrative = (
  basedOnSubmissionIds: string[],
): PassportNarrative => ({
  whatStoodOut: 'Cached text.',
  improvementSuggestions: [
    { id: 'sugg-1', area: 'OVERALL', text: 'Cached suggestion.' },
  ],
  basedOnSubmissionIds,
  generatedAt: '2026-01-01T00:00:00.000Z',
});

const generatedOutput = {
  whatStoodOut: 'Fresh text.',
  improvementSuggestions: [
    { area: 'OVERALL' as const, text: 'Fresh suggestion.' },
  ],
};

// A fake BaseChatModel: withGeminiSafeStructuredOutput only requires `.withStructuredOutput()`
// for anything that isn't a ChatGoogleGenerativeAI instance (see gemini-structured-output.util's
// non-Gemini branch), so this is the minimal shape that lets the real wrapper run unmodified.
const fakeModel = () => ({
  withStructuredOutput: () => ({
    pipe: () => ({
      invoke: jest.fn().mockResolvedValue(generatedOutput),
    }),
  }),
});

describe('PassportNarrativeService.getOrRegenerate', () => {
  it('returns the cached narrative unchanged when the last-3 submission ids match', async () => {
    const cached = cachedNarrative(['s1', 's2', 's3']);
    const jobSeekerProfileService = {
      getPassportNarrative: jest.fn().mockResolvedValue(cached),
      setPassportNarrative: jest.fn(),
    };
    const service = new PassportNarrativeService(
      fakeModel() as never,
      jobSeekerProfileService as never,
    );

    const result = await service.getOrRegenerate(
      PROFILE_ID,
      ['s1', 's2', 's3'],
      () => {
        throw new Error(
          'buildInput should not be called when the cache is fresh',
        );
      },
    );

    expect(result).toBe(cached);
    expect(jobSeekerProfileService.setPassportNarrative).not.toHaveBeenCalled();
  });

  it('regenerates and persists when the submission ids have moved on', async () => {
    const setPassportNarrative = jest
      .fn<Promise<void>, [string, PassportNarrative]>()
      .mockResolvedValue(undefined);
    const jobSeekerProfileService = {
      getPassportNarrative: jest
        .fn()
        .mockResolvedValue(cachedNarrative(['s1', 's2'])),
      setPassportNarrative,
    };
    const service = new PassportNarrativeService(
      fakeModel() as never,
      jobSeekerProfileService as never,
    );

    const result = await service.getOrRegenerate(
      PROFILE_ID,
      ['s2', 's3', 's4'],
      () => ({
        compositeScore: 700,
        compositeDelta: 50,
        weakestCategory: 'judgmentExecution',
        weakestDomain: 'Risk Management',
        recentSubmissions: [],
      }),
    );

    expect(result.whatStoodOut).toBe('Fresh text.');
    expect(setPassportNarrative).toHaveBeenCalledTimes(1);
    const [, persisted] = setPassportNarrative.mock.calls[0];
    expect(persisted.basedOnSubmissionIds).toEqual(['s2', 's3', 's4']);
    expect(persisted.improvementSuggestions[0]).toMatchObject({
      area: 'OVERALL',
      text: 'Fresh suggestion.',
    });
    expect(persisted.improvementSuggestions[0].id).toBeTruthy();
  });

  it('regenerates when there has never been a cached narrative', async () => {
    const jobSeekerProfileService = {
      getPassportNarrative: jest.fn().mockResolvedValue(null),
      setPassportNarrative: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PassportNarrativeService(
      fakeModel() as never,
      jobSeekerProfileService as never,
    );

    const result = await service.getOrRegenerate(PROFILE_ID, ['s1'], () => ({
      compositeScore: 500,
      compositeDelta: 0,
      weakestCategory: 'problemSolving',
      weakestDomain: 'Unspecified',
      recentSubmissions: [],
    }));

    expect(result.whatStoodOut).toBe('Fresh text.');
    expect(jobSeekerProfileService.setPassportNarrative).toHaveBeenCalledTimes(
      1,
    );
  });

  it('falls back to the stale cached narrative when generation fails, rather than throwing', async () => {
    const stale = cachedNarrative(['s1', 's2']);
    const jobSeekerProfileService = {
      getPassportNarrative: jest.fn().mockResolvedValue(stale),
      setPassportNarrative: jest.fn(),
    };
    const failingModel = {
      withStructuredOutput: () => ({
        pipe: () => ({
          invoke: jest.fn().mockRejectedValue(new Error('LLM unavailable')),
        }),
      }),
    };
    const service = new PassportNarrativeService(
      failingModel as never,
      jobSeekerProfileService as never,
    );

    const result = await service.getOrRegenerate(
      PROFILE_ID,
      ['s3', 's4'],
      () => ({
        compositeScore: 500,
        compositeDelta: 0,
        weakestCategory: 'problemSolving',
        weakestDomain: 'Unspecified',
        recentSubmissions: [],
      }),
    );

    expect(result).toBe(stale);
    expect(jobSeekerProfileService.setPassportNarrative).not.toHaveBeenCalled();
  });

  it('falls back to an empty narrative when generation fails and nothing was ever cached', async () => {
    const jobSeekerProfileService = {
      getPassportNarrative: jest.fn().mockResolvedValue(null),
      setPassportNarrative: jest.fn(),
    };
    const failingModel = {
      withStructuredOutput: () => ({
        pipe: () => ({
          invoke: jest.fn().mockRejectedValue(new Error('LLM unavailable')),
        }),
      }),
    };
    const service = new PassportNarrativeService(
      failingModel as never,
      jobSeekerProfileService as never,
    );

    const result = await service.getOrRegenerate(PROFILE_ID, ['s1'], () => ({
      compositeScore: 500,
      compositeDelta: 0,
      weakestCategory: 'problemSolving',
      weakestDomain: 'Unspecified',
      recentSubmissions: [],
    }));

    expect(result).toEqual({ whatStoodOut: '', improvementSuggestions: [] });
  });
});
