export interface RateLimitCheckResult {
  isRateLimit: boolean;
  retryAfterMs?: number;
  reason?: string;
}

/**
 * Inspects an exception thrown during LLM/AI operation to classify whether it's a rate limit,
 * quota exhaustion, or temporary 503 service unavailable error from SDKs (Gemini, Groq, OpenAI).
 */
export function classifyRateLimitError(error: unknown): RateLimitCheckResult {
  if (!error) return { isRateLimit: false };

  const message = error instanceof Error ? error.message : String(error);
  const status =
    (error as any)?.status ||
    (error as any)?.response?.status ||
    (error as any)?.statusCode;
  const code = (error as any)?.code || (error as any)?.error?.code;

  // Check HTTP 429 (Too Many Requests) or 503 (Service Unavailable / Over Capacity)
  if (status === 429 || status === 503) {
    const retryAfterHeader =
      (error as any)?.headers?.get?.('retry-after') ||
      (error as any)?.response?.headers?.['retry-after'];
    let retryAfterMs: number | undefined;
    if (retryAfterHeader) {
      const parsed = parseInt(String(retryAfterHeader), 10);
      if (!isNaN(parsed) && parsed > 0) {
        retryAfterMs = parsed * 1000;
      }
    }
    return {
      isRateLimit: true,
      retryAfterMs,
      reason: `HTTP ${status}: ${message}`,
    };
  }

  // Common AI SDK Rate Limit / Quota keywords
  const rateLimitKeywords = [
    'resource_exhausted',
    'ratelimit',
    'rate limit',
    'quota exceeded',
    'quota_exceeded',
    'too many requests',
    'tpm',
    'rpm',
    'over capacity',
  ];

  const lowerMsg = message.toLowerCase();
  const lowerCode = String(code || '').toLowerCase();

  if (
    rateLimitKeywords.some(
      (kw) => lowerMsg.includes(kw) || lowerCode.includes(kw),
    )
  ) {
    return {
      isRateLimit: true,
      reason: `Rate limit / quota error: ${message}`,
    };
  }

  return { isRateLimit: false };
}
