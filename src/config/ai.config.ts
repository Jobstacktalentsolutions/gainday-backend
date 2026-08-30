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
  },

  generationTemperature: 0.9,
  criticTemperature: 0,
};

export const generationConfig = {
  candidatePoolSize: 15,
  selectedTaskCount: 4,
  maxCriticAttempts: 3,
  duplicateSimilarityThreshold: 0.92,
  noveltyCheckTopK: 5,
  anchorScorePoints: [0, 3, 5, 7, 10],
};
