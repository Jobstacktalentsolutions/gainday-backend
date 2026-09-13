export const aiConfig = {
  // Groq has no embeddings API at all, so switching `provider` only changes which model
  // answers GENERATION_MODEL/CRITIC_MODEL — EMBEDDINGS always uses Gemini's embedding model
  // regardless of this setting (see ai.module.ts).
  provider: 'groq' as 'gemini' | 'groq',

  gemini: {
    // gemini-2.5-pro was retired for new users by Google (404 as of 2026-08-30).
    generationModel: 'gemini-3.5-flash',
    criticModel: 'gemini-3.5-flash',
    taskGenerationModel: 'gemini-3.5-flash',
    gradingModel: 'gemini-3.5-flash',
    embeddingModel: 'gemini-embedding-001',
    // @langchain/google-genai's GoogleGenerativeAIEmbeddings does not expose
    // outputDimensionality — gemini-embedding-001 returns a fixed 3072-dim vector
    // through this SDK. This must match the pgvector column width exactly.
    embeddingDimensions: 3072,
  },

  groq: {
    generationModel: 'openai/gpt-oss-20b',
    criticModel: 'openai/gpt-oss-20b',
    // The per-task-generation call has the deepest nested schema in the pipeline (anchors[].
    // criteria's 4 sibling free-text fields, repeated per anchor) — gpt-oss-20b reliably breaks
    // strict-mode JSON on this shape even with retries. The larger 120b model is far more
    // reliable at strict JSON adherence on deeply nested objects.
    taskGenerationModel: 'openai/gpt-oss-120b',
    // Anchor generation (grading/anchors/anchor-generation.service.ts) reuses TASK_GENERATION_MODEL
    // for the same reliability reasoning above — anchors[] is exactly that nested shape. Grading
    // itself (task-grading.service.ts) has a 4-category x {score,rationale,evidence} schema,
    // nested enough to warrant the same larger model rather than risking malformed output on a
    // call that runs unattended in a background worker.
    gradingModel: 'openai/gpt-oss-120b',
  },

  generationTemperature: 0.9,
  criticTemperature: 0,
  // Grading must be deterministic/reproducible across repeated scoring of the same answer (doc
  // Section 9) — kept as its own key (not reusing criticTemperature) so it can be tuned
  // independently even though both are 0 today.
  gradingTemperature: 0,
};

export const generationConfig = {
  candidatePoolSize: 15,
  selectedTaskCount: 4,
  maxCriticAttempts: 3,
  duplicateSimilarityThreshold: 0.92,
  noveltyCheckTopK: 5,
  anchorScorePoints: [0, 3, 5, 7, 10],
};

export const gradingConfig = {
  // Anchor generate-then-critique loop cap (grading/anchors/anchor-generation.service.ts) —
  // mirrors generationConfig.maxCriticAttempts. On exhaustion the last attempt is persisted
  // anyway (grading must not be permanently blocked by one bad question) and
  // question_bank.anchorsNeedReview is set true for admin follow-up.
  maxAnchorAttempts: 3,
  // Weights applied to the 4 (0-10 scale) category scores when rolling a submission's per-task
  // results up into the single 0-100 overallScore shown to employers/candidates.
  categoryWeights: {
    problemSolving: 0.4,
    judgmentExecution: 0.2,
    writtenCommunication: 0.2,
    commercialDomainAwareness: 0.2,
  },
};
