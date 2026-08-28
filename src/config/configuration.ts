import { URL } from 'url';

export default () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  let redisConfig: any = { host: 'localhost', port: 6379 };

  try {
    const parsed = new URL(redisUrl);
    redisConfig = {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
    };
  } catch (error) {
    console.error('Failed to parse REDIS_URL, using default localhost:', error);
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    database: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gainday',
    },
    redis: {
      url: redisUrl,
      host: redisConfig.host,
      port: redisConfig.port,
      username: redisConfig.username,
      password: redisConfig.password,
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    email: {
      brevoApiKey: process.env.BREVO_API_KEY || '',
      fromEmail: process.env.EMAIL_FROM || 'noreply@gainday.com',
      fromName: process.env.EMAIL_FROM_NAME || 'Gainday',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    ai: {
      provider: process.env.AI_PROVIDER || 'gemini',
      gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        generationModel: process.env.GEMINI_GENERATION_MODEL || 'gemini-2.5-pro',
        criticModel: process.env.GEMINI_CRITIC_MODEL || 'gemini-2.5-flash',
        embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
        // @langchain/google-genai's GoogleGenerativeAIEmbeddings does not expose
        // outputDimensionality — gemini-embedding-001 returns a fixed 3072-dim vector
        // through this SDK. This must match the pgvector column width exactly.
        embeddingDimensions: parseInt(process.env.GEMINI_EMBEDDING_DIMENSIONS || '3072', 10),
      },
      generationTemperature: parseFloat(process.env.AI_GENERATION_TEMPERATURE || '0.9'),
      criticTemperature: parseFloat(process.env.AI_CRITIC_TEMPERATURE || '0'),
    },
    generation: {
      candidatePoolSize: parseInt(process.env.GENERATION_CANDIDATE_POOL_SIZE || '15', 10),
      selectedTaskCount: parseInt(process.env.GENERATION_SELECTED_COUNT || '4', 10),
      maxCriticAttempts: parseInt(process.env.GENERATION_MAX_CRITIC_ATTEMPTS || '3', 10),
      duplicateSimilarityThreshold: parseFloat(
        process.env.GENERATION_DUPLICATE_SIMILARITY_THRESHOLD || '0.92',
      ),
      noveltyCheckTopK: parseInt(process.env.GENERATION_NOVELTY_TOP_K || '5', 10),
      anchorScorePoints: (process.env.GENERATION_ANCHOR_SCORE_POINTS || '0,3,5,7,10')
        .split(',')
        .map(Number),
    },
  };
};
