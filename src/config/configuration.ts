import { URL } from 'url';
import { aiConfig, generationConfig } from './ai.config';

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
      url:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/gainday',
    },
    redis: {
      url: redisUrl,
      host: redisConfig.host,
      port: redisConfig.port,
      username: redisConfig.username,
      password: redisConfig.password,
    },
    jwt: {
      secret:
        process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
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
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:3000/auth/google/callback',
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    ai: {
      ...aiConfig,
      gemini: {
        ...aiConfig.gemini,
        apiKey: process.env.GOOGLE_API_KEY || '',
      },
      groq: {
        ...aiConfig.groq,
        apiKey: process.env.GROQ_API_KEY || '',
      },
    },
    generation: generationConfig,
  };
};
