import { gradingConfig } from '../../../config/ai.config';
import { classifyRateLimitError } from './rate-limit.util';

/**
 * BullMQ custom backoff for the grading queue. An ordinary failure retries on a plain
 * exponential schedule; an API rate-limit / quota failure waits for the provider's own
 * `retry-after` when it gave one, otherwise a longer exponential schedule (capped), since
 * retrying within seconds just burns attempts against a limit that hasn't reset.
 */
export function gradingBackoffStrategy(
  attemptsMade: number,
  _type?: string,
  err?: Error,
): number {
  const exponent = Math.max(attemptsMade - 1, 0);
  const rateLimit = classifyRateLimitError(err);
  if (rateLimit.isRateLimit) {
    return (
      rateLimit.retryAfterMs ??
      Math.min(
        gradingConfig.rateLimitBackoffBaseMs * 2 ** exponent,
        gradingConfig.rateLimitBackoffMaxMs,
      )
    );
  }
  return gradingConfig.retryBackoffBaseMs * 2 ** exponent;
}
