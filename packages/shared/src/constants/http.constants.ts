/**
 * HTTP Status Codes and Error Codes — single source of truth.
 *
 * Eliminates magic numbers/strings scattered across frontend error handling,
 * interceptors, and backend guards.
 *
 * Backend:  use for comparing response.status in guards/filters
 * Web:      use in Axios interceptors and error-display components
 * Mobile:   use in apiClient interceptors and error categorization
 */

// ─── HTTP Status Codes ────────────────────────────────────────────────────────

export const HTTP_STATUS = {
  // 2xx Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // 3xx Redirect
  NOT_MODIFIED: 304,

  // 4xx Client Error
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // 5xx Server Error
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

// ─── Application Error Codes ──────────────────────────────────────────────────
// These mirror the backend's ErrorCode enum — keep in sync with:
// apps/food-waste-backend/src/common/exceptions/app.exceptions.ts (or similar)

export const ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  TOKEN_INVALID: 'AUTH_003',
  REFRESH_TOKEN_EXPIRED: 'AUTH_004',
  MFA_REQUIRED: 'AUTH_005',
  EMAIL_NOT_VERIFIED: 'AUTH_006',
  PHONE_NOT_VERIFIED: 'AUTH_007',
  ACCOUNT_SUSPENDED: 'AUTH_008',
  ACCOUNT_LOCKED: 'AUTH_009',

  // User
  USER_NOT_FOUND: 'USER_001',
  USER_ALREADY_EXISTS: 'USER_002',
  INSUFFICIENT_PERMISSIONS: 'USER_003',

  // Order
  ORDER_NOT_FOUND: 'ORDER_001',
  ORDER_ALREADY_EXISTS: 'ORDER_002',
  ORDER_EXPIRED: 'ORDER_003',
  ORDER_CANCELLED: 'ORDER_004',
  INVALID_PICKUP_CODE: 'ORDER_005',
  ORDER_NOT_READY: 'ORDER_006',

  // Offer
  OFFER_NOT_FOUND: 'OFFER_001',
  OFFER_SOLD_OUT: 'OFFER_002',
  OFFER_EXPIRED: 'OFFER_003',
  OFFER_NOT_AVAILABLE: 'OFFER_004',

  // Establishment
  ESTABLISHMENT_NOT_FOUND: 'EST_001',
  ESTABLISHMENT_NOT_ACTIVE: 'EST_002',

  // Payment
  PAYMENT_FAILED: 'PAY_001',
  PAYMENT_NOT_FOUND: 'PAY_002',
  REFUND_FAILED: 'PAY_003',

  // Validation
  VALIDATION_ERROR: 'VAL_001',
  INVALID_INPUT: 'VAL_002',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_001',

  // Server
  INTERNAL_ERROR: 'SRV_001',
  SERVICE_UNAVAILABLE: 'SRV_002',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
