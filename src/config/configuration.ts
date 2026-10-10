import { URL } from 'url';
import { aiConfig, generationConfig, gradingConfig } from './ai.config';

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
    port: parseInt(process.env.PORT || '5000', 10),
    admin: {
      email: process.env.ADMIN_EMAIL || 'admin@gainday.com',
      password: process.env.ADMIN_PASSWORD || 'adminpassword123',
    },
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
    auth: {
      admin2fa: {
        cooldownSeconds: parseInt(
          process.env.ADMIN_2FA_RESEND_COOLDOWN_SECONDS || '60',
          10,
        ),
        maxResends: parseInt(process.env.ADMIN_2FA_MAX_RESENDS || '5', 10),
        ttlMinutes: parseInt(
          process.env.ADMIN_2FA_EXPIRATION_MINUTES || '10',
          10,
        ),
      },
      emailVerification: {
        cooldownSeconds: parseInt(
          process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS || '60',
          10,
        ),
        maxResends: parseInt(
          process.env.EMAIL_VERIFICATION_MAX_RESENDS || '5',
          10,
        ),
        ttlHours: parseInt(
          process.env.EMAIL_VERIFICATION_TTL_HOURS || '24',
          10,
        ),
      },
      passwordReset: {
        cooldownSeconds: parseInt(
          process.env.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS || '60',
          10,
        ),
        maxRequests: parseInt(
          process.env.PASSWORD_RESET_MAX_REQUESTS || '5',
          10,
        ),
        ttlMinutes: parseInt(
          process.env.PASSWORD_RESET_TTL_MINUTES || '60',
          10,
        ),
      },
    },
    email: {
      brevoApiKey: process.env.BREVO_API_KEY || '',
      fromEmail: process.env.EMAIL_FROM || 'noreply@gainday.com',
      fromName: process.env.EMAIL_FROM_NAME || 'Gainday',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@gainday.com',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:3000/auth/google/callback',
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5000',
    ai: {
      ...aiConfig,
      provider: (process.env.AI_PROVIDER || aiConfig.provider) as
        | 'gemini'
        | 'groq'
        | 'fireworks',
      gemini: {
        ...aiConfig.gemini,
        apiKey:
          process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
      },
      groq: {
        ...aiConfig.groq,
        apiKey: process.env.GROQ_API_KEY || '',
      },
      fireworks: {
        ...aiConfig.fireworks,
        apiKey: process.env.FIREWORKS_API_KEY || '',
      },
    },
    generation: generationConfig,
    grading: gradingConfig,
  };
};
