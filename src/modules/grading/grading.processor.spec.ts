import { GradingProcessor } from './grading.processor';
import type { GradingService } from './grading.service';
import type { GradingSweeperService } from './grading-sweeper.service';

type FailedJob = Parameters<GradingProcessor['onFailed']>[0];

const job = (
  overrides: { attemptsMade: number; state: string; stallRecoveries?: number },
  attempts = 10,
): FailedJob =>
  ({
    name: 'grade-submission',
    data: { submissionId: 's1', stallRecoveries: overrides.stallRecoveries },
    attemptsMade: overrides.attemptsMade,
    opts: { attempts },
    getState: () => Promise.resolve(overrides.state),
  }) as unknown as FailedJob;

describe('GradingProcessor.onFailed', () => {
  const setup = () => {
    const gradingService = {
      markGradingFailed: jest.fn().mockResolvedValue(undefined),
      recoverStalledGrading: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new GradingProcessor(
      gradingService as unknown as GradingService,
      {} as GradingSweeperService,
    );
    return { processor, gradingService };
  };

  it('reports GRADING_FAILED once every attempt has been used', async () => {
    const { processor, gradingService } = setup();

    await processor.onFailed(
      job({ attemptsMade: 10, state: 'failed' }),
      new Error('quota exceeded'),
    );

    expect(gradingService.markGradingFailed).toHaveBeenCalledWith(
      's1',
      expect.stringContaining('quota exceeded'),
    );
    expect(gradingService.recoverStalledGrading).not.toHaveBeenCalled();
  });

  it('leaves an ordinary failure alone while a retry is scheduled', async () => {
    const { processor, gradingService } = setup();

    await processor.onFailed(
      job({ attemptsMade: 2, state: 'delayed' }),
      new Error('503'),
    );

    expect(gradingService.markGradingFailed).not.toHaveBeenCalled();
    expect(gradingService.recoverStalledGrading).not.toHaveBeenCalled();
  });

  it('recovers a stalled job, which fails with attempts left and no retry', async () => {
    const { processor, gradingService } = setup();

    await processor.onFailed(
      job({ attemptsMade: 1, state: 'failed', stallRecoveries: 2 }),
      new Error('job stalled more than allowable limit'),
    );

    expect(gradingService.recoverStalledGrading).toHaveBeenCalledWith('s1', 2);
    expect(gradingService.markGradingFailed).not.toHaveBeenCalled();
  });

  it('starts the recovery count at zero for a job queued before it existed', async () => {
    const { processor, gradingService } = setup();

    await processor.onFailed(
      job({ attemptsMade: 1, state: 'failed' }),
      new Error('job stalled more than allowable limit'),
    );

    expect(gradingService.recoverStalledGrading).toHaveBeenCalledWith('s1', 0);
  });
});
