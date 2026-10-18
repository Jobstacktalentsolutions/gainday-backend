import * as Joi from 'joi';

/**
 * Validated once at bootstrap (wired into ConfigModule.forRoot in app.module.ts) so a missing or
 * malformed env var fails fast with a clear message there, instead of surfacing later as a cryptic
 * runtime error deep inside whichever service first reads it (e.g. Stripe's SDK throwing
 * "Neither apiKey nor config.authenticator provided" when STRIPE_SECRET_KEY is unset).
 *
 * `.required()` here means "no value this app could fall back to is actually safe or functional"
 * — not every env var configuration.ts reads needs an entry: most have a workable default (a
 * local Redis/Postgres URL, a disabled optional integration) and are deliberately left out, so
 * configuration.ts's own `process.env.X || <default>` keeps doing its job for those.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port(),

  DATABASE_URL: Joi.string().uri().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
  }),

  // An insecure built-in fallback exists for local dev (configuration.ts), but signing tokens
  // with it in production would let anyone forge a session.
  JWT_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
  }),
  JWT_EXPIRES_IN: Joi.string(),

  // Stripe's own SDK has no functional fallback for a missing key — it throws on construction.
  // We validate that test keys exist in dev/test, and live keys exist in production (with fallback to generic keys).
  STRIPE_SECRET_KEY: Joi.string(),
  STRIPE_WEBHOOK_SECRET: Joi.string(),
  STRIPE_TEST_SECRET_KEY: Joi.string(),
  STRIPE_TEST_WEBHOOK_SECRET: Joi.string(),
  STRIPE_PROD_SECRET_KEY: Joi.string(),
  STRIPE_PROD_WEBHOOK_SECRET: Joi.string(),

  BREVO_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
  }),
  EMAIL_FROM: Joi.string(),
  EMAIL_FROM_NAME: Joi.string(),
  SUPPORT_EMAIL: Joi.string(),
  APP_URL: Joi.string().uri(),
  FRONTEND_URL: Joi.string().uri(),

  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }),

  GOOGLE_CLIENT_ID: Joi.string(),
  GOOGLE_CLIENT_SECRET: Joi.string(),
  GOOGLE_CALLBACK_URL: Joi.string().uri(),

  AI_PROVIDER: Joi.string().valid('gemini', 'groq', 'fireworks'),
  // EMBEDDINGS always calls Gemini regardless of AI_PROVIDER (see ai.module.ts), so one of
  // these two is required no matter which provider generates text.
  GEMINI_API_KEY: Joi.string(),
  GOOGLE_API_KEY: Joi.string(),
  GROQ_API_KEY: Joi.string().when('AI_PROVIDER', {
    is: 'groq',
    then: Joi.required(),
  }),
  FIREWORKS_API_KEY: Joi.string().when('AI_PROVIDER', {
    is: 'fireworks',
    then: Joi.required(),
  }),

  ADMIN_EMAIL: Joi.string(),
  ADMIN_PASSWORD: Joi.string(),
  ADMIN_2FA_RESEND_COOLDOWN_SECONDS: Joi.number(),
  ADMIN_2FA_MAX_RESENDS: Joi.number(),
  ADMIN_2FA_EXPIRATION_MINUTES: Joi.number(),
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: Joi.number(),
  EMAIL_VERIFICATION_MAX_RESENDS: Joi.number(),
  EMAIL_VERIFICATION_TTL_HOURS: Joi.number(),
  PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: Joi.number(),
  PASSWORD_RESET_MAX_REQUESTS: Joi.number(),
  PASSWORD_RESET_TTL_MINUTES: Joi.number(),

  SEED_EMPLOYER_EMAIL: Joi.string(),
})
  // Gemini's key is needed for embeddings regardless of provider, and additionally as the chat
  // model whenever AI_PROVIDER is 'gemini' (or left at its default) — expressed as a top-level
  // check because Joi's per-key `.when` can't express "one of these two keys", only one key
  // depending on another.
  .custom((value: Record<string, unknown>, helpers) => {
    const isProduction = value.NODE_ENV === 'production';

    // Catches the specific, silent-at-runtime failure mode this was added for: a webhook secret
    // left as the literal placeholder string from .env.example (e.g. "whsec_test_placeholder")
    // looks "present" (it even has the right "whsec_" prefix) to a plain `.required()` check,
    // but Stripe's real signature will never match it — every webhook call fails
    // `constructWebhookEvent` and gets rejected with 400, and Stripe retries for up to 3 days
    // before giving up, all without ever crediting a single purchase. Requires the real "whsec_"
    // shape AND rejects the word "placeholder" specifically, since the committed .env.example
    // value passes a bare prefix check.
    const isRealWebhookSecret = (secret: unknown): boolean =>
      typeof secret === 'string' &&
      /^whsec_/.test(secret) &&
      !/placeholder/i.test(secret);

    if (isProduction) {
      if (!value.STRIPE_PROD_SECRET_KEY && !value.STRIPE_SECRET_KEY) {
        return helpers.message({
          custom:
            '"STRIPE_PROD_SECRET_KEY" (or "STRIPE_SECRET_KEY") is required when NODE_ENV is "production"',
        });
      }
      const webhookSecret =
        value.STRIPE_PROD_WEBHOOK_SECRET ?? value.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return helpers.message({
          custom:
            '"STRIPE_PROD_WEBHOOK_SECRET" (or "STRIPE_WEBHOOK_SECRET") is required when NODE_ENV is "production"',
        });
      }
      if (!isRealWebhookSecret(webhookSecret)) {
        return helpers.message({
          custom:
            '"STRIPE_PROD_WEBHOOK_SECRET" is set but doesn\'t look like a real Stripe webhook secret (expected it to start with "whsec_") — copy the signing secret from the webhook endpoint in the Stripe Dashboard, not a placeholder',
        });
      }
    } else {
      if (!value.STRIPE_TEST_SECRET_KEY && !value.STRIPE_SECRET_KEY) {
        return helpers.message({
          custom:
            '"STRIPE_TEST_SECRET_KEY" (or "STRIPE_SECRET_KEY") is required in non-production environments',
        });
      }
      const webhookSecret =
        value.STRIPE_TEST_WEBHOOK_SECRET ?? value.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return helpers.message({
          custom:
            '"STRIPE_TEST_WEBHOOK_SECRET" (or "STRIPE_WEBHOOK_SECRET") is required in non-production environments',
        });
      }
      if (!isRealWebhookSecret(webhookSecret)) {
        return helpers.message({
          custom:
            '"STRIPE_TEST_WEBHOOK_SECRET" is set but doesn\'t look like a real Stripe webhook secret (expected it to start with "whsec_") — run `stripe listen --forward-to localhost:3000/payments/webhook` and copy the "whsec_..." it prints, not a placeholder',
        });
      }
    }

    const provider = (value.AI_PROVIDER as string | undefined) ?? 'gemini';
    if (
      provider === 'gemini' &&
      !value.GEMINI_API_KEY &&
      !value.GOOGLE_API_KEY
    ) {
      return helpers.message({
        custom:
          '"GEMINI_API_KEY" or "GOOGLE_APGI_KEY" is required (embeddings always use Gemini, and AI_PROVIDER is "gemini")',
      });
    }
    return value;
  })
  // Unknown keys (CI/platform-injected vars, anything not read by configuration.ts yet) are
  // allowed through rather than rejected — this schema's job is to catch missing/malformed
  // values this app depends on, not to be the single source of truth for every env var that
  // might exist in the process.
  .unknown(true);
