export const GRADING_QUEUE = 'grading';

/** Job names on the grading queue — GradingProcessor dispatches on these. */
export const GRADE_SUBMISSION_JOB = 'grade-submission';
export const SWEEP_STUCK_GRADING_JOB = 'sweep-stuck-grading';

/** A grading job in one of these states will still run (or is running), so its submission is not
 *  stuck — it is waiting its turn or backing off between retries. */
export const LIVE_JOB_STATES = [
  'waiting',
  'active',
  'delayed',
  'prioritized',
  'waiting-children',
];

/** Custom BullMQ backoff type — resolved by gradingBackoffStrategy on the worker. */
export const GRADING_BACKOFF_TYPE = 'grading';
