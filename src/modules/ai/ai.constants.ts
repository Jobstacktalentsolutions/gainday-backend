export const GENERATION_MODEL = Symbol('GENERATION_MODEL');
export const CRITIC_MODEL = Symbol('CRITIC_MODEL');
export const EMBEDDINGS = Symbol('EMBEDDINGS');
/** Larger/more capable model used only for the per-task-generation call (task-generation.node.ts),
 *  which has the pipeline's deepest nested schema (anchors[].criteria's 4 sibling string fields,
 *  repeated per anchor). Smaller models (e.g. Groq's gpt-oss-20b) reliably break strict-mode JSON
 *  on this specific shape even with retries — see gemini-structured-output.util.ts. */
export const TASK_GENERATION_MODEL = Symbol('TASK_GENERATION_MODEL');
