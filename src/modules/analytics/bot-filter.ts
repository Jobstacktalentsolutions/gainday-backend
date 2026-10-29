const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python-requests/i;

/** A missing user agent is treated as automated, since every real browser sends one. */
export function isBot(userAgent: string | undefined): boolean {
  return userAgent === undefined || BOT_PATTERN.test(userAgent);
}
