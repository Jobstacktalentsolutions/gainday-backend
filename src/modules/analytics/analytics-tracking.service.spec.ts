import Redis from 'ioredis';
import { AnalyticsTrackingService } from './analytics-tracking.service';

describe('AnalyticsTrackingService.allowPing', () => {
  const now = new Date('2026-10-26T10:00:30Z');

  function serviceWithCount(count: number | Error): AnalyticsTrackingService {
    const redis = {
      incr: jest.fn(() =>
        count instanceof Error ? Promise.reject(count) : Promise.resolve(count),
      ),
      expire: jest.fn(() => Promise.resolve(1)),
    };
    return new AnalyticsTrackingService(redis as unknown as Redis);
  }

  it('allows pings up to the per-minute limit', async () => {
    await expect(
      serviceWithCount(60).allowPing('visitor-1', now),
    ).resolves.toBe(true);
  });

  it('refuses the ping after the limit is passed', async () => {
    await expect(
      serviceWithCount(61).allowPing('visitor-1', now),
    ).resolves.toBe(false);
  });

  it('fails open when Redis is unavailable', async () => {
    await expect(
      serviceWithCount(new Error('connection refused')).allowPing(
        'visitor-1',
        now,
      ),
    ).resolves.toBe(true);
  });
});
