/**
 * Environment Variable Validation Schema
 *
 * Validates ALL required env vars at startup using Joi.
 * App will fail fast with clear error messages if any required var is missing.
 *
 * @see https://docs.nestjs.com/techniques/configuration#schema-validation
 */

import Joi from 'joi';

export const envValidationSchema = Joi.object({
  // ── Application ──────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

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
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // ── CORS ─────────────────────────────────────────────────────────────
  CORS_ORIGINS: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().messages({
      'any.required': 'CORS_ORIGINS is required in production (comma-separated origins)',
    }),
    otherwise: Joi.string().optional(),
  }),

  // ── Email / SMTP ─────────────────────────────────────────────────────
  BREVO_API_KEY: Joi.string().required().messages({
    'any.required': 'BREVO_API_KEY is required for Brevo email delivery',
  }),
  BREVO_API_BASE_URL: Joi.string().uri().default('https://api.brevo.com/v3'),
  BREVO_FROM_EMAIL: Joi.string().email().required().messages({
    'any.required': 'BREVO_FROM_EMAIL is required for Brevo email delivery',
  }),
  BREVO_FROM_NAME: Joi.string().default('Too Fresh To Waste'),

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

  // ── Payment (SMT) ───────────────────────────────────────────────────
  PAYMENT_ENABLED: Joi.boolean().default(true),
  SMT_WEBHOOK_SECRET: Joi.string().optional(),
  SMT_API_SECRET: Joi.string().optional(),
  PAYMENT_ENCRYPTION_KEY: Joi.string().optional(),

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
}).options({
  // Allow additional env vars not listed above (system vars, optional config)
  allowUnknown: true,
  // Strip unknown keys from the validated object (keeps config clean)
  stripUnknown: false,
});
