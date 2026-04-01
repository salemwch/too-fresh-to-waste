/**
 * Shared API types — single source of truth for all apps
 *
 * These types match the ACTUAL backend response format from TransformInterceptor.
 * Source: apps/food-waste-backend/src/common/interceptors/transFormInterceptor.ts
 */

/**
 * Pagination metadata returned in the `meta` field of list endpoints.
 *
 * Backend controllers attach this via `{ data, meta: { total, page, limit, ... } }`,
 * and the TransformInterceptor preserves it at the top level of the response envelope.
 */
export interface PaginationMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

/**
 * Canonical backend response envelope.
 *
 * Every endpoint response is wrapped by TransformInterceptor into this shape:
 * ```json
 * {
 *   "status": 200,
 *   "message": "Success message",
 *   "data": { ... },
 *   "meta": { "total": 50, "page": 1, "limit": 10 },
 *   "timestamp": "2026-03-30T12:00:00.000Z"
 * }
 * ```
 */
export interface ApiResponse<T = unknown> {
  /** HTTP status code (mirrors the HTTP response status) */
  status: number;

  /** Human-readable success/error message (optional — some endpoints omit it) */
  message?: string;

  /** Actual payload data (object, array, or null) */
  data: T;

  /** Optional pagination metadata (for list endpoints) */
  meta?: PaginationMeta;

  /** ISO 8601 timestamp of the response */
  timestamp: string;
}

/**
 * Standalone paginated response (used by endpoints that return pagination
 * in a nested `pagination` object rather than top-level `meta`).
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * NestJS exception filter error format.
 *
 * NestJS built-in exceptions use `statusCode` (not `status`).
 * This is intentionally different from the success envelope above.
 */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
  method?: string;
}
