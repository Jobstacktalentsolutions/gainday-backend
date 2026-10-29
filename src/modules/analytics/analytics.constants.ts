export const ANALYTICS_QUEUE = 'analytics';
export const SYNC_VISITOR_ANALYTICS_JOB = 'sync-visitor-analytics';

/** Redis keys for one London day. Every key is a hash keyed by visitor id. */
export const analyticsKeys = {
  /** visitorId -> audience (ANONYMOUS, JOB_SEEKER or EMPLOYER) for the day. */
  visitors: (day: string) => `analytics:day:${day}:visitors`,
  /** signed-in visitor id -> user id, for the day. */
  users: (day: string) => `analytics:day:${day}:users`,
  pageViews: (day: string) => `analytics:day:${day}:pageviews`,
  sessions: (day: string) => `analytics:day:${day}:sessions`,
  /** Presence marker for an active visit. Expires after the inactivity window. */
  session: (visitorId: string) => `analytics:session:${visitorId}`,
  /** Page-view pings from one visitor in one clock minute. */
  pingRate: (visitorId: string, minute: number) =>
    `analytics:rate:${visitorId}:${minute}`,
};

export const DAY_KEY_PATTERN = 'analytics:day:*:visitors';
export const DAY_KEY_REGEX = /^analytics:day:(\d{4}-\d{2}-\d{2}):visitors$/;
