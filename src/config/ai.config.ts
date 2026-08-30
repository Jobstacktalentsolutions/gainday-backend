export const aiConfig = {
  provider: 'gemini' as const,

  gemini: {
    // gemini-2.5-pro was retired for new users by Google (404 as of 2026-08-30).
    generationModel: 'gemini-2.5-flash',
    criticModel: 'gemini-2.5-flash',
    embeddingModel: 'gemini-embedding-001',
    // @langchain/google-genai's GoogleGenerativeAIEmbeddings does not expose
    // outputDimensionality — gemini-embedding-001 returns a fixed 3072-dim vector
    // through this SDK. This must match the pgvector column width exactly.
    embeddingDimensions: 3072,
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
