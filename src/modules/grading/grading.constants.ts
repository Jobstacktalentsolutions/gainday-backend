export const GRADING_QUEUE = 'grading';

/** Job names on the grading queue — GradingProcessor dispatches on these. */
export const GRADE_SUBMISSION_JOB = 'grade-submission';
export const SWEEP_STUCK_GRADING_JOB = 'sweep-stuck-grading';

/** Custom BullMQ backoff type — resolved by gradingBackoffStrategy on the worker. */
export const GRADING_BACKOFF_TYPE = 'grading';
