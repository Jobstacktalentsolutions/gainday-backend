import { classifyRateLimitError } from './rate-limit.util';

describe('classifyRateLimitError', () => {
  it('should identify HTTP 429 status code', () => {
    const error = { status: 429, message: 'Too Many Requests' };
    const res = classifyRateLimitError(error);
    expect(res.isRateLimit).toBe(true);
    expect(res.reason).toContain('HTTP 429');
  });

  it('should extract retry-after header if present', () => {
    const error = {
      status: 429,
      message: 'Rate limit hit',
      response: { headers: { 'retry-after': '30' } },
    };
    const res = classifyRateLimitError(error);
    expect(res.isRateLimit).toBe(true);
    expect(res.retryAfterMs).toBe(30000);
  });

  it('should identify RESOURCE_EXHAUSTED in error message', () => {
    const error = new Error('GoogleGenerativeAIError: RESOURCE_EXHAUSTED quota exceeded');
    const res = classifyRateLimitError(error);
    expect(res.isRateLimit).toBe(true);
    expect(res.reason).toContain('quota exceeded');
  });

  it('should return isRateLimit false for standard errors', () => {
    const error = new Error('Syntax error in prompt template');
    const res = classifyRateLimitError(error);
    expect(res.isRateLimit).toBe(false);
  });
});
