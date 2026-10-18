import { envValidationSchema } from './env.validation';

// Minimal set of other required vars so each test below isolates the webhook-secret check
// rather than tripping over an unrelated one.
const baseEnv = {
  NODE_ENV: 'development',
  STRIPE_TEST_SECRET_KEY: 'sk_test_abc123',
  GEMINI_API_KEY: 'gemini-key',
};

const validate = (env: Record<string, unknown>) =>
  envValidationSchema.validate(env, { abortEarly: false });

describe('envValidationSchema — Stripe webhook secret', () => {
  it('rejects a missing webhook secret', () => {
    const { error } = validate(baseEnv);
    expect(error?.message).toMatch(/STRIPE_TEST_WEBHOOK_SECRET/);
  });

  it('rejects the committed .env.example placeholder, even though it has the right prefix', () => {
    const { error } = validate({
      ...baseEnv,
      STRIPE_TEST_WEBHOOK_SECRET: 'whsec_test_placeholder',
    });
    expect(error?.message).toMatch(
      /doesn't look like a real Stripe webhook secret/,
    );
  });

  it('rejects a value with no "whsec_" prefix at all', () => {
    const { error } = validate({
      ...baseEnv,
      STRIPE_TEST_WEBHOOK_SECRET: 'not-a-real-secret',
    });
    expect(error?.message).toMatch(
      /doesn't look like a real Stripe webhook secret/,
    );
  });

  it('accepts a real-shaped webhook secret', () => {
    const { error } = validate({
      ...baseEnv,
      STRIPE_TEST_WEBHOOK_SECRET: 'whsec_abcdef1234567890',
    });
    expect(error).toBeUndefined();
  });

  it('applies the same check to the production webhook secret', () => {
    const { error } = validate({
      NODE_ENV: 'production',
      STRIPE_PROD_SECRET_KEY: 'sk_live_abc123',
      STRIPE_PROD_WEBHOOK_SECRET: 'whsec_live_placeholder',
      JWT_SECRET: 'a-real-jwt-secret',
      DATABASE_URL: 'postgres://localhost:5432/db',
      BREVO_API_KEY: 'brevo-key',
      GEMINI_API_KEY: 'gemini-key',
    });
    expect(error?.message).toMatch(
      /STRIPE_PROD_WEBHOOK_SECRET.*doesn't look like a real Stripe webhook secret/,
    );
  });
});
