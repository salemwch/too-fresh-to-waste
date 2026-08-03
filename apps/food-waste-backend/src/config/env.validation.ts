/**
 * Environment Variable Validation Schema
 *
 * Validates ALL required env vars at startup using Joi.
 * App will fail fast with clear error messages if any required var is missing.
 *
 * @see https://docs.nestjs.com/techniques/configuration#schema-validation
 */

import Joi from 'joi';

import { PROCESS_ROLE_VALUES, ProcessRole } from './process-role';

export const envValidationSchema = Joi.object({
  // ── Application ──────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  /*
   * Which responsibilities this process carries — see `process-role.ts`.
   *
   * Validated here so a typo fails at startup rather than silently disabling
   * every scheduled job. `getProcessRole()` reads `process.env` directly and
   * falls back to `all`, so an unvalidated value would not crash; it would just
   * quietly stop payouts. Joi is what makes that unreachable.
   */
  PROCESS_ROLE: Joi.string()
    .valid(...PROCESS_ROLE_VALUES)
    .default(ProcessRole.ALL)
    .messages({
      'any.only': `PROCESS_ROLE must be one of: ${PROCESS_ROLE_VALUES.join(', ')}`,
    }),

  /*
   * PM2 cluster worker count. Not read by the app itself — `ecosystem.config.js`
   * uses it — but validated here because it multiplies MONGO_MAX_POOL_SIZE into
   * the real connection count, and getting it wrong exhausts the database.
   */
  WEB_CONCURRENCY: Joi.number().integer().min(1).default(2),

  // ── Database ─────────────────────────────────────────────────────────
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required (MongoDB connection string)',
  }),

  // ── Redis ────────────────────────────────────────────────────────────
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_TLS_PORT: Joi.number().port().optional(),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_USERNAME: Joi.string().default('default'),

  // ── JWT (required — no fallback secrets allowed) ─────────────────────
  JWT_SECRET: Joi.string().min(32).required().messages({
    'any.required':
      "JWT_SECRET is required (generate with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\")",
    'string.min': 'JWT_SECRET must be at least 32 characters',
  }),
  JWT_REFRESH_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_REFRESH_SECRET is required and must differ from JWT_SECRET',
    'string.min': 'JWT_REFRESH_SECRET must be at least 32 characters',
  }),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  /**
   * Standard (non "remember me") refresh token lifetime.
   *
   * Was '365d'. Because Joi APPLIES this default, `configService.get()` always
   * returns a value — which made the `?? '7d'` fallback in token.service.ts
   * dead code and silently gave every ordinary sign-in a token valid for a
   * year. A stolen refresh token is a bearer credential, so that was a
   * year-long account-takeover window on a token the code intended to be
   * short-lived. The cookie maxAge in auth.controller.ts already documents the
   * intent as 30 days; this now matches it.
   */
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  /**
   * "Remember me" refresh token lifetime. Longer by design — the user opted in.
   * Declared explicitly so the value is validated and discoverable rather than
   * living only as a `??` fallback inside token.service.ts.
   */
  JWT_REFRESH_REMEMBER_ME_EXPIRES_IN: Joi.string().default('365d'),

  // ── CORS ─────────────────────────────────────────────────────────────
  CORS_ORIGINS: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().messages({
      'any.required': 'CORS_ORIGINS is required in production (comma-separated origins)',
    }),
    otherwise: Joi.string().optional(),
  }),

  // ── Email (Resend) ───────────────────────────────────────────────────
  RESEND_API_KEY: Joi.string().required().messages({
    'any.required': 'RESEND_API_KEY is required for Resend email delivery',
  }),
  EMAIL_FROM_ADDRESS: Joi.string().email().required().messages({
    'any.required': 'EMAIL_FROM_ADDRESS is required for email delivery',
  }),
  EMAIL_FROM_NAME: Joi.string().default('Too Fresh To Waste'),

  // ── URLs ─────────────────────────────────────────────────────────────
  BACKEND_URL: Joi.string().uri().required().messages({
    'any.required': 'BACKEND_URL is required for email verification links',
  }),
  FRONTEND_URL: Joi.string().required(),
  WEB_FRONTEND_URL: Joi.string().allow('').optional(),

  // ── Application Branding ────────────────────────────────────────────
  SUPPORT_EMAIL: Joi.string().email().default('support@foodwaste.com'),
  APP_NAME: Joi.string().default('Food Waste Management'),

  // ── Redis TLS ──────────────────────────────────────────────────────
  REDIS_TLS: Joi.string().valid('true', 'false').default('false'),
  REDIS_TLS_REJECT_UNAUTHORIZED: Joi.string().valid('true', 'false').default('true'),
  REDIS_TLS_CHECK_SERVER_IDENTITY: Joi.string().valid('true', 'false').default('true'),
  REDIS_TLS_MIN_VERSION: Joi.string().default('TLSv1.2'),
  REDIS_CONNECT_TIMEOUT: Joi.number().positive().default(10000),
  REDIS_COMMAND_TIMEOUT: Joi.number().positive().default(5000),
  REDIS_MAX_RETRIES: Joi.number().integer().min(0).default(10),

  // ── Cookie ───────────────────────────────────────────────────────────
  COOKIE_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required().messages({
      'any.required': 'COOKIE_SECRET is required in production',
    }),
    otherwise: Joi.string().optional(),
  }),

  // ── Payment ─────────────────────────────────────────────────────────
  PAYMENT_ENABLED: Joi.boolean().default(true),
  PAYMENT_ENCRYPTION_KEY: Joi.string().optional(),

  // ── Konnect Subscription Payments ──────────────────────────────────
  KONNECT_API_KEY: Joi.string().allow('').default(''),
  KONNECT_WALLET_ID: Joi.string().allow('').default(''),
  KONNECT_API_URL: Joi.string().default('https://api.preprod.konnect.network/api/v2'),
  KONNECT_WEBHOOK_URL: Joi.string().default(
    'http://localhost:3000/api/v1/subscriptions/webhook/konnect',
  ),
  KONNECT_SUBSCRIPTION_SUCCESS_URL: Joi.string().default(
    'http://localhost:3001/merchant/subscription/success',
  ),
  KONNECT_SUBSCRIPTION_FAIL_URL: Joi.string().default(
    'http://localhost:3001/merchant/subscription/failed',
  ),

  // ── Konnect Order Payments ──────────────────────────────────────────
  KONNECT_PAYMENT_TIMEOUT_MINUTES: Joi.number().integer().min(5).max(60).default(15),
  KONNECT_ORDER_WEBHOOK_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri({ scheme: 'https' }).required().messages({
      'any.required': 'KONNECT_ORDER_WEBHOOK_URL is required in production (HTTPS)',
    }),
    otherwise: Joi.string().default('http://localhost:3000/api/v1/payments/webhook/konnect'),
  }),
  MOBILE_DEEP_LINK: Joi.string().default('toofreshtowaste'),

  // ── Privacy ──────────────────────────────────────────────────────────
  PRIVACY_ENCRYPTION_KEY: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required().messages({
      'any.required': 'PRIVACY_ENCRYPTION_KEY is required in production for GDPR compliance',
    }),
    otherwise: Joi.string().optional(),
  }),

  // ── Firebase ─────────────────────────────────────────────────────────
  FIREBASE_SERVICE_ACCOUNT_PATH: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().messages({
      'any.required':
        'FIREBASE_SERVICE_ACCOUNT_PATH is required in production (push notifications)',
    }),
    otherwise: Joi.string().optional(),
  }),
  FIREBASE_PROJECT_ID: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().messages({
      'any.required': 'FIREBASE_PROJECT_ID is required in production',
    }),
    otherwise: Joi.string().optional(),
  }),

  // ── Supabase Storage ─────────────────────────────────────────────────
  SUPABASE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri().required().messages({
      'any.required': 'SUPABASE_URL is required in production (image uploads)',
    }),
    otherwise: Joi.string().optional(),
  }),
  SUPABASE_SERVICE_ROLE_KEY: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().messages({
      'any.required': 'SUPABASE_SERVICE_ROLE_KEY is required in production',
    }),
    otherwise: Joi.string().optional(),
  }),

  // ── Phone Verification Feature Flag ─────────────────────────────────
  // Set to false to bypass SMS OTP while Twilio is unpaid.
  // Twilio credentials are kept intact — flip back to true to re-enable.
  PHONE_VERIFICATION_ENABLED: Joi.boolean().default(false),

  // ── Twilio SMS ───────────────────────────────────────────────────────
  TWILIO_ACCOUNT_SID: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().messages({
      'any.required': 'TWILIO_ACCOUNT_SID is required in production (SMS verification)',
    }),
    otherwise: Joi.string().optional(),
  }),
  TWILIO_AUTH_TOKEN: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().messages({
      'any.required': 'TWILIO_AUTH_TOKEN is required in production',
    }),
    otherwise: Joi.string().optional(),
  }),
  TWILIO_PHONE_NUMBER: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().messages({
      'any.required': 'TWILIO_PHONE_NUMBER is required in production',
    }),
    otherwise: Joi.string().optional(),
  }),

  // ── Sentry ───────────────────────────────────────────────────────────
  SENTRY_DSN: Joi.string().allow('').optional(), // optional — app runs without it, but errors won't be tracked

  // ── RabbitMQ ─────────────────────────────────────────────────────────
  RABBITMQ_URL: Joi.when('RABBITMQ_ENABLED', {
    is: Joi.valid(true, 'true'),
    then: Joi.string().required().messages({
      'any.required': 'RABBITMQ_URL is required when RABBITMQ_ENABLED=true',
    }),
    otherwise: Joi.string().optional(),
  }),
  RABBITMQ_ENABLED: Joi.boolean().default(false),
  /**
   * Analytics result caching (analytics.service.ts).
   *
   * Declared here because it is read as `configService.get<boolean>(...)`.
   * Environment variables arrive as strings, and Joi is what coerces them —
   * without an entry, setting `ANALYTICS_CACHE_ENABLED=false` yielded the
   * *string* `"false"`, which is truthy, so the flag could be set but never
   * actually turned the cache off. The `<boolean>` type argument made it look
   * safe: it asserts a type, it does not convert anything.
   */
  ANALYTICS_CACHE_ENABLED: Joi.boolean().default(true),

  // ── Delivery economics ───────────────────────────────────────────────
  //
  // Declared so Joi COERCES them to numbers. They are read as
  // `configService.get<number>(...)`, but env vars arrive as strings and the
  // type argument only asserts — it converts nothing. Undeclared,
  // `FLAT_DELIVERY_FEE=4.0` yielded the string "4.0"; it survived only because
  // `fee - earnings` coerces, and the first `+` written against it would have
  // silently concatenated into a nonsense total.
  //
  // Model: customer pays food + FLAT_DELIVERY_FEE on delivery orders (never on
  // pickup, and never because of the payment method). The fee splits
  // driver / platform as DRIVER_DELIVERY_EARNINGS / the remainder, so the
  // driver's share must not exceed the fee.
  FLAT_DELIVERY_FEE: Joi.number().min(0).default(4.0),
  DRIVER_DELIVERY_EARNINGS: Joi.number()
    .min(0)
    .max(Joi.ref('FLAT_DELIVERY_FEE'))
    .default(3.0)
    .messages({
      'number.max':
        'DRIVER_DELIVERY_EARNINGS cannot exceed FLAT_DELIVERY_FEE — the platform would pay the driver more than it collects on every delivery.',
    }),
  MAX_DELIVERY_KM: Joi.number().positive().default(5),
}).options({
  // Allow additional env vars not listed above (system vars, optional config)
  allowUnknown: true,
  // Strip unknown keys from the validated object (keeps config clean)
  stripUnknown: false,
});
