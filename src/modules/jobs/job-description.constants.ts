// Maximum length of a saved job description. Enforced by the job DTOs.
export const JOB_DESCRIPTION_MAX_LENGTH = 5000;

// What the AI is asked to aim for when rewriting a description. Set below the hard maximum so the
// model's output has headroom and still passes validation on save.
export const JOB_DESCRIPTION_TARGET_LENGTH = 4500;
