/**
 * Visitor analytics tuning. Change the numbers here, not in the tracking or sync code.
 *
 * - timezone: a "day" is a London calendar day, matching the job-recommendation schedule.
 * - cronPattern: the end-of-day sync runs just after midnight so the previous day is complete.
 * - sessionTtlSeconds: a visit ends after this much inactivity (30 minutes).
 * - dayKeyTtlSeconds: Redis keys for a day expire after this, so a missed sync can catch up.
 * - maxPingsPerMinute: page-view pings one visitor may send in a minute before they are refused.
 *   A person clicking quickly stays well under this; a script does not.
 */
export const analyticsConfig = {
  timezone: 'Europe/London',
  cronPattern: '5 0 * * *',
  sessionTtlSeconds: 30 * 60,
  dayKeyTtlSeconds: 7 * 24 * 60 * 60,
  rollingWindowDays: 30,
  maxPingsPerMinute: 60,
};
